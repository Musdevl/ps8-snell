import { config } from "../config.js";

/**
 * Appels vers le user service.
 *
 * ATTENTION : ces trois routes n'existent pas encore côté user (elles sont à
 * créer lors du branchement, cf. README « Ce qu'il reste à faire côté user »).
 * Tant qu'elles manquent, les demandes de mail partent correctement mais l'étape
 * finale échoue avec un log explicite — c'est volontaire, pour que le service
 * mail soit livrable et testable seul.
 */

async function call(path, options = {}) {
    const response = await fetch(`${config.userServiceUrl}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
    });

    if (response.status === 404) return null;

    if (!response.ok) {
        throw new Error(`user service ${path} a répondu ${response.status}`);
    }

    return await response.json();
}

/** @returns {Promise<{userId: string, username: string} | null>} */
export async function findUserByEmail(email) {
    return await call(`/api/user/internal/by-email/${encodeURIComponent(email)}`);
}

export async function markAccountVerified(userId) {
    return await call("/api/user/internal/verify-account", {
        method: "POST",
        body: JSON.stringify({ userId }),
    });
}

export async function setPassword(userId, new_password) {
    return await call("/api/user/internal/set-password", {
        method: "POST",
        body: JSON.stringify({ userId, new_password }),
    });
}
