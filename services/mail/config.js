import { readFileSync } from "fs";
import { load } from "js-yaml";

// Le chemin est résolu par rapport à ce fichier, pas au répertoire de travail :
// le service démarre correctement quel que soit l'endroit d'où node est lancé.
const CONFIG_PATH = new URL("./config.yaml", import.meta.url);

const file = load(readFileSync(CONFIG_PATH, "utf8")) || {};

if (!file.smtp) {
    throw new Error("config.yaml : la section 'smtp' est absente");
}

export const config = {
    from: file.from || "Snell <no-reply@snell.local>",
    smtp: {
        host: file.smtp.host,
        port: file.smtp.port,
        // Comparaison stricte : en YAML, `secure: false` donne bien un booléen,
        // mais `secure: "false"` donnerait une chaîne, qui est toujours vraie.
        secure: file.smtp.secure === true,
        user: file.smtp.user || "",
        pass: file.smtp.pass || "",
    },
};
