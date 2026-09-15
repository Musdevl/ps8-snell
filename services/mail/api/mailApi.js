import express from "express";

import * as mailService from "../services/mailService.js";
import { welcomeMail } from "../templates/welcome.js";
import { resetPasswordMail } from "../templates/reset-password.js";

const app = express();

app.use(express.json());

// Nodemailer ignore silencieusement un destinataire sans "@" et échoue ensuite
// avec "No recipients defined" : on refuse en amont, avec un message clair.
function isEmail(value) {
    return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// GET /api/mail/health
app.get("/api/mail/health", async (req, res) => {
    const smtp = await mailService.checkTransport();
    res.json({ status: "ok", smtp: { target: mailService.target, ...smtp } });
});

// POST /api/mail/welcome
app.post("/api/mail/welcome", async (req, res) => {
    try {
        const { to, username } = req.body || {};

        if (!isEmail(to)) {
            console.log(`[MAIL API] - Destinataire invalide refusé : ${JSON.stringify(to)}`);
            return res.status(400).json({ error: "to doit être une adresse mail valide" });
        }

        await mailService.send(to, welcomeMail({ username }));

        res.json({ success: true });
    } catch (error) {
        console.error("[MAIL API] - Échec de l'envoi du mail de bienvenue:", error);
        res.status(500).json({ error: "Échec de l'envoi du mail de bienvenue", message: error.message });
    }
});

// POST /api/mail/password-reset
app.post("/api/mail/password-reset", async (req, res) => {
    try {
        const { to, username, link } = req.body || {};

        if (!isEmail(to) || !link) {
            console.log(`[MAIL API] - Destinataire invalide refusé : ${JSON.stringify(to)}`);
            return res.status(400).json({ error: "to doit être une adresse mail valide, et link est requis" });
        }

        await mailService.send(to, resetPasswordMail({ username, link }));

        res.json({ success: true });
    } catch (error) {
        console.error("[MAIL API] - Échec de l'envoi du mail de reset:", error);
        res.status(500).json({ error: "Échec de l'envoi du mail de reset", message: error.message });
    }
});

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Start the server
export function startHttpServer(port) {
    const PORT = port;
    const server = app.listen(PORT, () => { });

    process.on("SIGTERM", () => { server.close(() => { process.exit(0); }); });
    process.on("SIGINT", () => { server.close(() => { process.exit(0); }); });

    return server;
}
