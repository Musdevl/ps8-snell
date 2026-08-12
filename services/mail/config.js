const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const config = {
    env: process.env.ENV || "dev",
    port: Number(process.env.MAIL_SERVICE_PORT) || 8006,

    mongoUrl: process.env.MONGO_DB_URL || "mongodb://localhost:27017",
    dbName: "snelldb",

    userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:8010",

    // URL par laquelle un navigateur atteint la gateway. C'est la base de tous
    // les liens envoyés par mail, donc elle doit être joignable depuis l'extérieur
    // (IP publique du VPS tant qu'il n'y a pas de nom de domaine).
    publicUrl: process.env.PUBLIC_GATEWAY_URL || "http://localhost:8000",

    smtp: {
        host: process.env.SMTP_HOST || "mailpit",
        port: Number(process.env.SMTP_PORT) || 1025,
        // true pour du SMTPS (port 465), false pour du STARTTLS (ports 587 / 1025)
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
    },

    from: process.env.MAIL_FROM || "Snell <no-reply@snell.local>",

    ttl: {
        VERIFY_ACCOUNT: 24 * HOUR,
        RESET_PASSWORD: 1 * HOUR,
    },

    // Délai minimum entre deux mails du même type pour la même adresse
    resendCooldown: 1 * MINUTE,
};

export const TOKEN_TYPE = {
    VERIFY_ACCOUNT: "VERIFY_ACCOUNT",
    RESET_PASSWORD: "RESET_PASSWORD",
};

/**
 * Les défauts ci-dessus conviennent en dev (Mailpit, gateway sur localhost) mais
 * sont inutilisables en prod. Plutôt que de faire échouer tout le compose sur une
 * variable manquante — ce qui empêcherait le jeu de démarrer pour un problème de
 * mail — on démarre quand même et on signale bruyamment ce qui manque.
 */
export function configWarnings() {
    const warnings = [];

    if (!process.env.PUBLIC_GATEWAY_URL) {
        warnings.push(
            `PUBLIC_GATEWAY_URL absent : la base des liens sera déduite de l'hôte de chaque requête, ` +
            `avec repli sur ${config.publicUrl}. Suffisant pour du dev, à renseigner dès qu'il y aura un domaine.`
        );
    }

    if (!process.env.SMTP_HOST) {
        warnings.push(`SMTP_HOST absent : repli sur "${config.smtp.host}", qui n'existe qu'en dev.`);
    }

    if (!process.env.MAIL_FROM) {
        warnings.push(`MAIL_FROM absent : repli sur "${config.from}", que la plupart des relais refuseront.`);
    }

    return warnings;
}
