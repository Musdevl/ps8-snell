import crypto from "crypto";
import { config } from "../config.js";
import * as tokenRepo from "../repositories/token-repository.js";

/**
 * Le token en clair ne vit que dans le lien envoyé par mail. En base on ne
 * stocke que son SHA-256 : une fuite de la collection ne permet pas de forger
 * un lien valide.
 */
function hash(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function issue(type, { userId, email }) {
    const ttl = config.ttl[type];
    if (!ttl) throw new Error(`Type de token inconnu: ${type}`);

    // Un seul lien valide à la fois : demander un nouveau mail invalide le précédent.
    await tokenRepo.revokePending(userId, type);

    const rawToken = crypto.randomBytes(32).toString("hex");

    await tokenRepo.saveToken({
        tokenHash: hash(rawToken),
        type,
        userId,
        email,
        expiresAt: new Date(Date.now() + ttl),
        consumedAt: null,
    });

    return rawToken;
}

/** Vérifie sans consommer — utilisé pour valider un lien avant d'afficher un formulaire. */
export async function peek(type, rawToken) {
    if (typeof rawToken !== "string" || rawToken.length !== 64) {
        return { valid: false, reason: "invalid" };
    }

    const token = await tokenRepo.findByHash(hash(rawToken));

    if (!token || token.type !== type) return { valid: false, reason: "invalid" };
    if (token.consumedAt) return { valid: false, reason: "used" };
    if (token.expiresAt.getTime() < Date.now()) return { valid: false, reason: "expired" };

    return { valid: true, token };
}

/** Vérifie puis consomme. Un token ne peut être consommé qu'une fois. */
export async function redeem(type, rawToken) {
    const result = await peek(type, rawToken);
    if (!result.valid) return result;

    const consumed = await tokenRepo.consume(result.token.tokenHash);
    if (!consumed) return { valid: false, reason: "used" };

    return { valid: true, token: result.token };
}
