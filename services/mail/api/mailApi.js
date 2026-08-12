import express from "express";

import * as mailService from "../services/mailService.js";
import { verifyAccountMail } from "../templates/verify-account.js";
import { resetPasswordMail } from "../templates/reset-password.js";

const app = express();

app.use(express.json());

// GET /api/mail/health
app.get("/api/mail/health", async (req, res) => {
    const smtp = await mailService.checkTransport();
    res.json({ status: "ok", smtp: { target: mailService.target, ...smtp } });
});

// POST /api/mail/verification
app.post("/api/mail/verification", async (req, res) => {
    try {
        const { to, username, link } = req.body || {};

        if (!to || !link) {
            return res.status(400).json({ error: "to et link sont requis" });
        }

        await mailService.send(to, verifyAccountMail({ username, link }));

        res.json({ success: true });
    } catch (error) {
        console.error("[MAIL API] - Échec de l'envoi du mail de validation:", error);
        res.status(500).json({ error: "Échec de l'envoi du mail de validation", message: error.message });
    }
});

// POST /api/mail/password-reset
app.post("/api/mail/password-reset", async (req, res) => {
    try {
        const { to, username, link } = req.body || {};

        if (!to || !link) {
            return res.status(400).json({ error: "to et link sont requis" });
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
    const server = app.listen(PORT, () => {
        console.log(`[MAIL SERVICE] Server listening on port ${PORT}`);
    });

    process.on("SIGTERM", () => { server.close(() => { process.exit(0); }); });
    process.on("SIGINT", () => { server.close(() => { process.exit(0); }); });

    return server;
}
