import { Server } from 'socket.io';
import * as MatchmakingManager from './manager/MatchmakingManager.js'

import { GameManager } from './manager/GameManager.js';
import * as gameApi from "../api/gameApi.js"
import { gatewayConnection, formatToSend } from './shared.js';

const gameManager = new GameManager();

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8000";

const PORT = 8002;

// Temps mort avant que l'IA ne joue. Il ne sert pas a corriger une course :
// il laisse au joueur le temps de voir la position avant la reponse de l'IA,
// aussi bien au premier coup qu'apres chacun des siens.
const AI_MOVE_DELAY_MS = 1000;
const server = gameApi.startHttpServer(PORT, gameManager);

const ioServer = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: false
    },
    rejectUnauthorized: false,
    reconnection: true,
});


ioServer.on('connection', (socket) => {

    console.log(`GATEWAY Client connected to Game Service with id: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`GATEWAY Client connected to Game Service with id: ${socket.id}`);
    });

    socket.on('join', (data) => {
        handleJoin(data)
    });

    socket.on('action', async (data) => await handleAction(data));

    socket.on('leave', (data) => handleLeave(data));

    socket.on('send-message', (data) => handleSendMessage(data));

    socket.on('ask-draw', (data) => { handleAskDraw(data); });

    socket.on('accept-draw', (data) => { handleAcceptDraw(data); });

    socket.on('deny-draw', (data) => { handleDenyDraw(data); });

    socket.on('forfeit', (data) => { handleForfeit(data); });

});

gatewayConnection.on('connect', () => { console.log('GAME SERVICE CLIENT Connected to gateway'); });

// Gestion Timeout

gameManager.on("timeout", (data) => {
    gatewayConnection.emit("game-ws-service", {
        webSocketIds: (data.game.gameType === "LOCAL") ? data.players_web_sockets[0] : data.players_web_sockets,
        event: "update",
        data: data.game
    })
})


function handleLeave(data) {
    try {

        const playerInfo = {
            webSocketId: data.clientId,
            jwt: data.token,
            userId: data.userId
        };

        // waiting-room sans gameId
        if (data.gameType === "MULTI" && !data.gameId) {
            MatchmakingManager.remove(playerInfo);
            return;
        }

        const res = gameManager.leaveGame(data.gameId, data.userId);

        // notify other players if game type is MUTLI
        if (data.gameType === "MULTI") {
            gatewayConnection.emit(
                "game-ws-service",
                formatToSend(res.players_web_sockets, "update", res.game)
            );
        }
    } catch (error) {
        console.log(error)
    }
}

function handleAskDraw(data) {
    try {
        const res = gameManager.askDraw(data.gameId, data.userId)
        gatewayConnection.emit("game-ws-service", formatToSend(res.players_web_sockets, "draw-asked"));
    } catch (error) {
        console.log(error)
    }
}

function handleAcceptDraw(data) {
    try {
        const res = gameManager.acceptDraw(data.gameId, data.userId);
        gatewayConnection.emit("game-ws-service", formatToSend(res.players_web_sockets, "update", res.game));
    } catch (error) {
        console.log(error);
    }
}

function handleForfeit(data) {
    try {
        const res = gameManager.forfeit(data.gameId, data.userId);
        gatewayConnection.emit("game-ws-service", formatToSend(res.players_web_sockets, "update", res.game));
    } catch (error) {
        console.log(error)
    }
}

function handleDenyDraw(data) {
    try {
        const res = gameManager.denyDraw(data.gameId, data.userId);
        gatewayConnection.emit("game-ws-service", formatToSend(res.players_web_sockets, "draw-denied"))
    } catch (error) {
        console.log(error)
    }
}

async function handleJoin(data) {
    try {
        const playerInfo = {
            webSocketId: data.clientId,
            userId: data.userId,
            gameMode: data.gameMode || 600,
            playerColor: data.playerColor
        };

        let res;

        const reconnect_status = gameManager.tryReconnect(playerInfo, data.gameType);

        if (reconnect_status) {
            console.log("[GAME SERVICE] - Reconnecting... ");
            res = formatToSend([playerInfo.webSocketId], "reconnect", reconnect_status.game)
            gatewayConnection.emit("game-ws-service", res);
            // Se reconnecter pendant le tour de l'IA ne doit pas figer la
            // partie : personne d'autre ne relancerait son coup.
            if (data.gameType === "AI") scheduleAiMove(gameManager.findGame(res.data.gameId));
            return;
        }

        switch (data.gameType) {
            case "LOCAL":
                res = await handleSinglePlayerGame(playerInfo, data.gameType);
                break;
            case "AI":
                const aiInfo = {
                    userId: data.aiId
                }
                res = await handleAiGame(playerInfo, aiInfo);
                break;
            case "MULTI":
                res = await handleMultiplayerGame(playerInfo);
                break;
            default:
                throw new Error("Unknown Game Type");
        }

        gatewayConnection.emit("game-ws-service", res);

        // Le client recoit d'abord "start" avec la position de depart, puis
        // "update" avec le coup de l'IA si elle a les blancs.
        if (data.gameType === "AI") scheduleAiMove(gameManager.findGame(res.data.gameId));
    } catch (error) {
        console.log(error);
    }
}

async function handleSinglePlayerGame(playerInfo, gameType) {
    try {
        const game = await gameManager.initGame(gameType, playerInfo, playerInfo, playerInfo.gameMode);
        return formatToSend([game.players_web_sockets[0]], "start", game.game);
    } catch (error) {
        console.log(error)
        throw error;
    }
}

async function handleAiGame(playerInfo, aiInfo) {
    try {
        const game = await gameManager.initGame("AI", playerInfo, aiInfo, playerInfo.gameMode);
        return game.players_web_sockets[0] === "NONE" ? formatToSend([game.players_web_sockets[1]], "start", game.game) : formatToSend([game.players_web_sockets[0]], "start", game.game);
    } catch (error) {
        console.log(error);
        throw error;
    }
}


async function handleMultiplayerGame(playerInfo) {
    try {
        const { status, players } = await MatchmakingManager.queue(playerInfo);
        if (status === 'waiting') return formatToSend([playerInfo.webSocketId], "matchmaking:waiting-for-players", {});
        if (status === 'already_queued') return formatToSend([playerInfo.webSocketId], "matchmaking:already-queued", {});
    } catch (error) {
        console.log(error)
    }


}

MatchmakingManager.matchEvents.on('match', async (players, timePerPlayer) => {
    let res = await createMultiplayerMatch(players, timePerPlayer);
    MatchmakingManager.remove(players[0]);
    MatchmakingManager.remove(players[1]);
    gatewayConnection.emit("game-ws-service", res);
})




async function createMultiplayerMatch(players, timePerPlayer) {
    try {
        const game = await gameManager.initGame("MULTI", players[0], players[1], timePerPlayer);
        return formatToSend(game.players_web_sockets, "start", game.game);
    } catch (error) {
        console.log(error);
    }

}

function handleAction(data) {
    try {
        const game = gameManager.findGame(data.gameId);

        if (game) {

            const res = handlePlayerAction(game.gameType, game, data.action, data.clientId);

            // Action refusee (ce n'est pas son tour, coup illegal...) : il n'y
            // a rien a diffuser, et emettre undefined casserait le gateway.
            if (!res) return;

            gatewayConnection.emit("game-ws-service", res);

            if (game.gameType === "AI" && res.data.status === "CONTINUE") scheduleAiMove(game);

        } else {
            console.log("No Game Found")
        }
    } catch (error) {
        console.log(error);
    }
}

function handlePlayerAction(gameType, game, action, player_web_socket_id) {
    try {
        const game_buffer = gameManager.processAction(game, action, player_web_socket_id);
        let webSocketIds = (gameType === "LOCAL") ? game_buffer.players_web_sockets[0] : game_buffer.players_web_sockets;
        return formatToSend(webSocketIds, "update", game_buffer.game);
    } catch (error) {
        console.log(error);
    }

}

/**
 * Fait jouer l'IA si c'est son tour. Regroupe les trois moments ou ca arrive :
 * a la creation de la partie quand l'IA a les blancs, apres chaque coup du
 * joueur, et apres une reconnexion tombee pendant le tour de l'IA.
 */
function scheduleAiMove(game) {
    if (!gameManager.isAiToPlay(game)) return;

    setTimeout(async () => {
        const res = await handleAiAction(game);
        // handleAiAction rend null si le service IA est injoignable : emettre
        // quand meme ferait planter le handler du gateway au destructuring.
        if (res) gatewayConnection.emit("game-ws-service", res);
    }, AI_MOVE_DELAY_MS);
}

async function handleAiAction(game) {
    try {
        const game_buffer = await gameManager.processAiAction(game);
        if (!game_buffer) throw new Error("AI service returned no action");
        return formatToSend(game_buffer.players_web_sockets, "update", game_buffer.game);
    } catch (error) {
        console.error("[GAME SERVICE] - AI move failed:", error);
        return null;
    }
}

async function handleSendMessage(data) {
    try {
        const res = await gameManager.processMessage(data);
        return gatewayConnection.emit("game-ws-service", formatToSend(res.players_web_sockets, "new-message", res.message));
    } catch (error) {
        console.log(error)
    }
}

