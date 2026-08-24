import nodemailer from "nodemailer";

import { config } from "../config.js";

// Sans identifiants on ne passe pas d'auth du tout : c'est ce qu'attend Mailpit,
// le faux SMTP de développement, qui accepte les connexions anonymes.
const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
});

export const target = `${config.smtp.host}:${config.smtp.port}`;

export async function send(to, mail) {
    const info = await transporter.sendMail({
        from: config.from,
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
    });

    console.log(`[MAIL SERVICE] - "${mail.subject}" envoyé à ${to}`);
    return info;
}

// Teste la connexion au relais sans envoyer de mail. Utilisé par /api/mail/health.
export async function checkTransport() {
    try {
        await transporter.verify();
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}
