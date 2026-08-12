import express from "express";

import { config, TOKEN_TYPE } from "../config.js";
import * as tokenService from "../services/tokenService.js";
import * as mailer from "../services/mailer.js";
import * as userClient from "../services/userClient.js";
import { verifyAccountMail } from "../templates/verify-account.js";
import { resetPasswordMail } from "../templates/reset-password.js";
import { renderConsole } from "../templates/console.js";

const app = express();

app.use(express.json());

// Mêmes en-têtes que badExpress, pour que le service reste utilisable
// directement (tests locaux) et pas seulement derrière la gateway.
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// ─── Anti-spam ───────────────────────────────────────────────────────────────

const lastSentAt = new Map();

function isRateLimited(email, type) {
    const key = `${type}:${email.toLowerCase()}`;
    const previous = lastSentAt.get(key);

    if (previous && Date.now() - previous < config.resendCooldown) return true;

    lastSentAt.set(key, Date.now());
    return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GATEWAY_PORT = 8000;

function isValidEmail(email) {
    return typeof email === "string" && EMAIL_PATTERN.test(email);
}

/**
 * Base publique des liens envoyés par mail.
 *
 * PUBLIC_GATEWAY_URL fait toujours foi. Sans elle, on retombe sur l'hôte par
 * lequel la requête est arrivée : http-proxy conserve l'en-tête Host d'origine,
 * donc une requête passée par la gateway porte bien l'adresse publique. Ça évite
 * d'avoir à configurer quoi que ce soit pour un simple `docker compose up` sur un
 * serveur distant. Un vrai nom de domaine rendra PUBLIC_GATEWAY_URL obligatoire.
 */
function resolvePublicBase(req) {
    if (process.env.PUBLIC_GATEWAY_URL) return process.env.PUBLIC_GATEWAY_URL;

    const hostname = req?.headers?.host?.split(":")[0];

    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `http://${hostname}:${GATEWAY_PORT}`;
    }

    return config.publicUrl;
}

/** Construit un lien vers la gateway (celui qui part dans le mail). */
function gatewayLink(req, path, params) {
    const url = new URL(path, resolvePublicBase(req));
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
}

/** Redirige le navigateur vers une page du front avec un état dans l'URL. */
function redirectToFront(req, res, path, params) {
    return res.redirect(302, gatewayLink(req, path, params));
}

function isDev() {
    return config.env !== "prod";
}

// ─── Santé ───────────────────────────────────────────────────────────────────

app.get("/api/mail/health", (req, res) => {
    res.json({
        status: "ok",
        env: config.env,
        smtp: mailer.getTransportStatus(),
        publicBase: resolvePublicBase(req),
    });
});

// ─── Validation de compte ────────────────────────────────────────────────────

// Appelée par le user service à l'inscription (ou pour un renvoi de mail).
app.post("/api/mail/verification/request", async (req, res) => {
    try {
        const { userId, email, username } = req.body || {};

        if (!userId || !isValidEmail(email)) {
            return res.status(400).json({ error: "userId et email valides requis" });
        }

        if (isRateLimited(email, TOKEN_TYPE.VERIFY_ACCOUNT)) {
            return res.status(429).json({ error: "Un mail vient déjà d'être envoyé, réessaie dans une minute" });
        }

        const rawToken = await tokenService.issue(TOKEN_TYPE.VERIFY_ACCOUNT, { userId, email });
        const url = gatewayLink(req, "/api/mail/verification/confirm", { token: rawToken });

        await mailer.send({ to: email, ...verifyAccountMail({ username, url }) });

        res.json({ success: true });
    } catch (error) {
        console.error("[MAIL API] - Échec de l'envoi du mail de validation:", error);
        res.status(500).json({ error: "Échec de l'envoi du mail de validation" });
    }
});

// Cliquée depuis le mail, donc forcément en GET et sans session.
app.get("/api/mail/verification/confirm", async (req, res) => {
    try {
        const result = await tokenService.redeem(TOKEN_TYPE.VERIFY_ACCOUNT, req.query.token);

        // Un token déjà consommé veut dire que le compte est validé : on affiche
        // un succès. C'est aussi ce qui protège des antivirus et des « safe links »
        // qui pré-ouvrent les URL des mails avant l'utilisateur.
        if (!result.valid && result.reason === "used") {
            return redirectToFront(req, res, "/pages/auth/login/", { verified: "1" });
        }

        if (!result.valid) {
            return redirectToFront(req, res, "/pages/auth/login/", { verified: "0", reason: result.reason });
        }

        await userClient.markAccountVerified(result.token.userId);

        redirectToFront(req, res, "/pages/auth/login/", { verified: "1" });
    } catch (error) {
        console.error("[MAIL API] - Échec de la validation du compte:", error);
        redirectToFront(req, res, "/pages/auth/login/", { verified: "0", reason: "error" });
    }
});

// ─── Mot de passe oublié ─────────────────────────────────────────────────────

app.post("/api/mail/password-reset/request", async (req, res) => {
    const { email } = req.body || {};

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Email valide requis" });
    }

    // On répond toujours la même chose, que le compte existe ou non : sinon
    // cette route devient un moyen de savoir quelles adresses sont inscrites.
    const genericResponse = { success: true };

    try {
        if (isRateLimited(email, TOKEN_TYPE.RESET_PASSWORD)) return res.json(genericResponse);

        const user = await userClient.findUserByEmail(email);

        if (!user) {
            console.log(`[MAIL API] - Demande de reset pour une adresse inconnue (${email}), aucun mail envoyé`);
            return res.json(genericResponse);
        }

        const rawToken = await tokenService.issue(TOKEN_TYPE.RESET_PASSWORD, { userId: user.userId, email });
        const url = gatewayLink(req, "/api/mail/password-reset/confirm", { token: rawToken });

        await mailer.send({ to: email, ...resetPasswordMail({ username: user.username, url }) });

        res.json(genericResponse);
    } catch (error) {
        console.error("[MAIL API] - Échec de l'envoi du mail de reset:", error);
        res.json(genericResponse);
    }
});

// Cliquée depuis le mail : on valide le lien sans le consommer, puis on renvoie
// vers le front qui affichera le formulaire de nouveau mot de passe.
app.get("/api/mail/password-reset/confirm", async (req, res) => {
    try {
        const result = await tokenService.peek(TOKEN_TYPE.RESET_PASSWORD, req.query.token);

        if (!result.valid) {
            return redirectToFront(req, res, "/pages/auth/login/", { reset: "0", reason: result.reason });
        }

        redirectToFront(req, res, "/pages/auth/login/", { reset_token: req.query.token });
    } catch (error) {
        console.error("[MAIL API] - Échec de la vérification du lien de reset:", error);
        redirectToFront(req, res, "/pages/auth/login/", { reset: "0", reason: "error" });
    }
});

// Appelée par le front avec le token récupéré dans l'URL.
app.post("/api/mail/password-reset/complete", async (req, res) => {
    try {
        const { token, new_password } = req.body || {};

        if (typeof new_password !== "string" || new_password.length < 8) {
            return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" });
        }

        const result = await tokenService.redeem(TOKEN_TYPE.RESET_PASSWORD, token);

        if (!result.valid) {
            return res.status(400).json({ error: "Lien invalide ou expiré", reason: result.reason });
        }

        await userClient.setPassword(result.token.userId, new_password);

        res.json({ success: true });
    } catch (error) {
        console.error("[MAIL API] - Échec du changement de mot de passe:", error);
        res.status(500).json({ error: "Échec du changement de mot de passe" });
    }
});

// ─── Console d'envoi (hors prod) ─────────────────────────────────────────────

// Petite page servie par le service lui-même, pour déclencher un envoi depuis un
// navigateur sans monter tout un parcours d'inscription. En dev le port 8006 est
// publié, donc elle est joignable sur http://<hote>:8006 sans passer par la
// gateway — et donc sans JWT.

app.get("/", (req, res) => {
    if (!isDev()) return res.status(404).json({ error: "Route not found" });
    res.redirect(302, "/api/mail/console");
});

app.get("/api/mail/console", (req, res) => {
    if (!isDev()) return res.status(404).json({ error: "Route not found" });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderConsole({ smtp: mailer.getTransportStatus(), publicBase: resolvePublicBase(req) }));
});

// Envoie un vrai mail, avec un vrai token : le lien reçu est cliquable et
// déroule le même chemin que le parcours réel. Seul l'utilisateur est fictif.
app.post("/api/mail/test", async (req, res) => {
    if (!isDev()) return res.status(404).json({ error: "Route not found" });

    try {
        const { to, type = TOKEN_TYPE.VERIFY_ACCOUNT } = req.body || {};

        if (!isValidEmail(to)) return res.status(400).json({ error: "Email valide requis" });
        if (!TOKEN_TYPE[type]) return res.status(400).json({ error: "Type de mail inconnu" });

        const rawToken = await tokenService.issue(type, { userId: "test-user", email: to });

        const path = type === TOKEN_TYPE.VERIFY_ACCOUNT
            ? "/api/mail/verification/confirm"
            : "/api/mail/password-reset/confirm";

        const url = gatewayLink(req, path, { token: rawToken });

        const mail = type === TOKEN_TYPE.VERIFY_ACCOUNT
            ? verifyAccountMail({ username: "Testeur", url })
            : resetPasswordMail({ username: "Testeur", url });

        await mailer.send({ to, ...mail });

        res.json({ success: true, type, to, subject: mail.subject, link: url });
    } catch (error) {
        console.error("[MAIL API] - Échec du mail de test:", error);
        res.status(500).json({ error: error.message });
    }
});

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

export function startHttpServer() {
    const server = app.listen(config.port, () => {
        console.log(`[MAIL SERVICE] Server listening on port ${config.port}`);
        if (isDev()) console.log(`[MAIL SERVICE] Console d'envoi : http://localhost:${config.port}/api/mail/console`);
    });

    return server;
}
