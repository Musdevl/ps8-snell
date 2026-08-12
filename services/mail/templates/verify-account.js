import { render, escapeHtml } from "./layout.js";

export function verifyAccountMail({ username, url }) {
    const content = {
        preheader: "Confirme ton adresse pour activer ton compte Snell.",
        heading: `Bienvenue${username ? ` ${escapeHtml(username)}` : ""} !`,
        body: [
            "Ton compte Snell est créé. Il ne reste plus qu'à confirmer ton adresse mail pour pouvoir jouer en ligne.",
            "Un seul clic suffit :",
        ],
        buttonLabel: "Confirmer mon adresse",
        buttonUrl: url,
        footnote:
            "Ce lien expire dans 24 heures et ne peut être utilisé qu'une fois. " +
            "Si tu n'as pas créé de compte Snell, ignore ce message : aucun compte ne sera activé.",
    };

    return {
        subject: "Confirme ton adresse mail — Snell",
        ...render(content),
    };
}
