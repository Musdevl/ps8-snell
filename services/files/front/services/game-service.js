import { GATEWAY_URL } from "../env.js";
import * as accountService from "./account-service.js";
import * as userService from "./user-service.js";

// Load Socket IO
await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${GATEWAY_URL}/js/socket.io.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
});

let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;
let endMessage;
let userId;
let gameType;
let gameId;

let leaveBtn;

const io = window.io;

let socket = io(`${GATEWAY_URL}/game`);

socket.on('connect', () => { console.log('[Game] Socket connected:', socket.id); });
socket.on('connect_error', (error) => { console.error('[Game] Socket connection error:', error); });

export function getSocketConnection() { return socket; }

export function sendMessage(message) {
    if (accountService.getUserId()) {
        socket.emit('message', {
            message: message,
            userId: accountService.getUserId()
        })
    }
}

export function setGameType(newGameType) {
    gameType = newGameType
}


export function startNewGame(gameType) {
    socket.emit("join", { gameType: gameType, userId: userId });
    boardComponent.clearSelection();
    endMessage.clear()
}


export function init() {
    leaveBtn.addEventListener("click", () => {
        socket.emit("leave", { gameType: GAME_TYPE, userId: userId, gameId: gameId })
        window.location.replace(`/`)
    })
}

export async function fetchGameChat(gameId) {
    const res = await accountService.authFetch(`${GATEWAY_URL}/api/chat/game/${gameId}`, {
        method: "GET"
    });
    return await res.json();
}