import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter;
let lastVerification = { ok: false, error: "not checked yet" };

export function initTransport() {
    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        // Mailpit accepte les connexions anonymes : pas d'auth si pas d'identifiants.
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });

    return transporter;
}

/**
 * Teste la connexion SMTP sans bloquer le démarrage : en dev le conteneur
 * mailpit peut ne pas être encore prêt, et le service doit rester utilisable.
 */
export async function verifyTransport() {
    try {
        await transporter.verify();
        lastVerification = { ok: true, error: null };
        console.log(`[MAILER] - SMTP joignable sur ${config.smtp.host}:${config.smtp.port}`);
    } catch (error) {
        lastVerification = { ok: false, error: error.message };
        console.warn(`[MAILER] - SMTP injoignable (${config.smtp.host}:${config.smtp.port}): ${error.message}`);
    }
    return lastVerification;
}

export function getTransportStatus() {
    return { ...lastVerification, host: config.smtp.host, port: config.smtp.port };
}

export async function send({ to, subject, html, text }) {
    const info = await transporter.sendMail({ from: config.from, to, subject, html, text });
    console.log(`[MAILER] - Mail "${subject}" envoyé à ${to} (id: ${info.messageId})`);
    return info;
}
