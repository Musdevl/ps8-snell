const GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || "http://localhost:8002";

// Parties en cours par mode, comptées par le service game (il tient les parties
// en mémoire, rien n'est en base tant qu'une partie n'est pas terminée).
export async function getLiveGames() {
    const response = await fetch(`${GAME_SERVICE_URL}/api/game/stats/live`);

    if (!response.ok) {
        throw new Error(`Service game injoignable (${response.status})`);
    }

    return await response.json();
}
