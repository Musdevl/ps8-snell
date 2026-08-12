import * as mailApi from "./api/mailApi.js";
import * as mailer from "./services/mailer.js";
import * as tokenRepo from "./repositories/token-repository.js";
import { configWarnings } from "./config.js";

for (const warning of configWarnings()) {
    console.warn(`[MAIL SERVICE] - CONFIGURATION INCOMPLÈTE : ${warning}`);
}

await tokenRepo.initDatabase();

mailer.initTransport();
// Pas de await : un SMTP injoignable ne doit pas empêcher le service de démarrer,
// le résultat du test est consultable sur /api/mail/health.
mailer.verifyTransport();

const server = mailApi.startHttpServer();

async function shutdown() {
    server.close();
    await tokenRepo.closeDatabase();
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
