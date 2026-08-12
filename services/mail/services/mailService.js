import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "mailpit";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 1025;
// true pour du TLS direct (port 465), false pour du STARTTLS (ports 587, 2525, 1025)
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || "Snell <no-reply@snell.local>";

// Sans identifiants on ne passe pas d'auth du tout : c'est ce qu'attend Mailpit,
// le faux SMTP de dev, qui accepte les connexions anonymes.
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export const target = `${SMTP_HOST}:${SMTP_PORT}`;

export async function send(to, mail) {
    const info = await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
    });

    console.log(`[MAIL SERVICE] - "${mail.subject}" envoyé à ${to}`);
    return info;
}

export async function checkTransport() {
    try {
        await transporter.verify();
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}
