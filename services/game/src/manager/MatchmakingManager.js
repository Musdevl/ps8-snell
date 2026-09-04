import { EventEmitter } from "events";

let USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010";
let players = [];
let playersTimeout = new Map();

export const matchEvents = new EventEmitter();


async function createPlayer(userId, webSocketId) {
    let req = await fetch(USER_SERVICE_URL + "/api/user/info/" + userId, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
    });

    if (!req.ok) {
        console.log("Error while creating player");
    }
    let player = await req.json();

    return { userId, webSocketId, elo: player.elo, range: 50 };

}

export async function queue(rawPlayer) {
    let player = await createPlayer(rawPlayer.userId, rawPlayer.webSocketId);
    player.gameMode = rawPlayer.gameMode;

    let found_player = players.find(p => p.userId === rawPlayer.userId);

    if (found_player) {
        found_player.webSocketId = player.webSocketId;
        return { status: 'already_queued', players: [...players] };
    }

    players.push(player);
    updateTimeout(player);

    return { status: 'waiting', players: [...players] };
}

function updateTimeout(player) {

    if (playersTimeout[player.userId]) {
        clearTimeout(playersTimeout[player.userId]);
    }

    playersTimeout[player.userId] = setInterval(() => {
        player.range += 50;
        getPlayersInRange(player);
    }, 4000)
}



function getPlayersInRange(player) {
    let playerLow = player.elo - player.range;
    let playerHigh = player.elo + player.range;

    players.forEach(p => {
        if (p.userId === player.userId) return;
        if (p.gameMode !== player.gameMode) return;

        let pLow = p.elo - p.range;
        let pHigh = p.elo + p.range;

        if (playerHigh >= pLow && playerLow <= pHigh || playerLow >= pLow && playerHigh <= pHigh) {
            matchEvents.emit("match", [{ ...p }, { ...player }], player.gameMode);
        }
    });
}

export function remove(player) {
    const before = players.length;
    players = players.filter(p => p.userId !== player.userId);
    playersTimeout[player.userId] && clearInterval(playersTimeout[player.userId]);
    return before !== players.length;
}