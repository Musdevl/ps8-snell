const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010";

async function getUserStats(path) {
    const response = await fetch(`${USER_SERVICE_URL}${path}`);

    if (!response.ok) {
        throw new Error(`Service user injoignable (${response.status})`);
    }

    return await response.json();
}

// Statistiques d'inscription, calculées par le service user (c'est lui qui a la base).
export async function getRegistrationStats(days = 7) {
    return await getUserStats(`/api/user/stats/registrations?days=${days}`);
}

// Users actuellement connectés, comptés par le service user (il tient les sockets).
export async function getOnlineUsers() {
    return await getUserStats('/api/user/stats/online');
}
