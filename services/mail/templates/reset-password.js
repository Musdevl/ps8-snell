import { render, escapeHtml } from "./layout.js";

export function resetPasswordMail({ username, url }) {
    const content = {
        preheader: "Réinitialise ton mot de passe Snell.",
        heading: "Réinitialisation de ton mot de passe",
        body: [
            `Quelqu'un a demandé un nouveau mot de passe pour le compte${username ? ` <strong>${escapeHtml(username)}</strong>` : ""}.`,
            "Si c'est bien toi, choisis un nouveau mot de passe ici :",
        ],
        buttonLabel: "Choisir un nouveau mot de passe",
        buttonUrl: url,
        footnote:
            "Ce lien expire dans 1 heure et ne peut être utilisé qu'une fois. " +
            "Si tu n'es pas à l'origine de cette demande, ignore ce message : ton mot de passe actuel reste valable.",
    };

    return {
        subject: "Réinitialisation de ton mot de passe — Snell",
        ...render(content),
    };
}
