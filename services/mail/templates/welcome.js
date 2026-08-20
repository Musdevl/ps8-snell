import { render, escapeHtml } from "./layout.js";

export function welcomeMail({ username }) {
    const content = {
        preheader: "Ton compte Snell est prêt.",
        heading: `Bienvenue${username ? ` ${escapeHtml(username)}` : ""} !`,
        body: [
            "Ton compte Snell est créé, tu peux commencer à jouer.",
            "Snell est une réinterprétation de Khet : tu déplaces ou tu tournes une pièce, puis tu tires ton laser. Le premier qui touche le roi adverse gagne. Le tutoriel te fait le tour des règles en quelques minutes.",
        ],
        footnote: "Si tu n'as pas créé de compte Snell, tu peux ignorer ce message.",
    };

    return {
        subject: "Bienvenue sur Snell",
        ...render(content),
    };
}
