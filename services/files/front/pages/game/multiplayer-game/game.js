import { GATEWAY_URL } from "../../../env.js";
import * as gameService from "../../../services/game-service.js";
import { COLORS } from "../../../enum/Colors.js";
import * as accountService from "../../../services/account-service.js";
import { notify } from "../../../services/notification-service.js";
import * as notificationService from "../../../services/notification-service.js";

// ─── State ───────────────────────────────────────────────────────────────

let socket;
let userId;
let opponentId;
let gameId;
const GAME_TYPE = "MULTI";

let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;
let endMessage;
let game_chat;
let notification;

let waiting_room;
let game_container;
let leave_btn;
let chat_btn;
let leave_chat_btn;
let modal;
let modal_message;
let modal_confirm;
let modal_cancel;

await accountService.checkAuth();

async function init() {
    userId = accountService.getUserId();

    socket = gameService.getSocketConnection();
    socket.on('connect', () => console.log('[Game] Socket connected:', socket.id));
    socket.on('connect_error', (error) => console.error('[Game] Socket connection error:', error));

    await waitForBoard();
    await setupGameChat();
    await setupGame();
    await startNewGame();
}

async function waitForBoard() {
    await customElements.whenDefined('game-board');
    await customElements.whenDefined('player-info');

    boardComponent = document.querySelector('game-board');
    whitePlayerInfoComponent = document.querySelector('.white');
    blackPlayerInfoComponent = document.querySelector('.black');
    endMessage = document.querySelector('end-message');
    notification = document.querySelector('notification-bar');

    waiting_room = document.querySelector(".waiting-section");
    game_container = document.querySelector('.game-container');
    leave_btn = document.querySelector(".leave-btn");
    chat_btn = document.querySelector(".chat-btn");
    leave_chat_btn = document.querySelector(".mobile-chat-leave");

    modal = document.getElementById('game-modal');
    modal_message = document.getElementById('modal-message');
    modal_confirm = document.getElementById('modal-confirm');
    modal_cancel = document.getElementById('modal-cancel');
    modal_cancel.addEventListener('click', () => closeModal());

    await Promise.all([
        boardComponent.readyPromise,
        whitePlayerInfoComponent.readyPromise,
        blackPlayerInfoComponent.readyPromise,
    ]);
}

async function setupGame() {
    setupSocketEvents();
    setupBoardEvents();
    setupControls();

    await whitePlayerInfoComponent.setColor(COLORS.WHITE);
    await blackPlayerInfoComponent.setColor(COLORS.BLACK);

    setupPlayerInfoEvents(whitePlayerInfoComponent);
    setupPlayerInfoEvents(blackPlayerInfoComponent);
    setupEndMessage(endMessage);
}

function setupSocketEvents() {
    socket.on('start', async (data) => {
        await onGameReady(data);

        const whitePlayerInfo = await getUserInformation(data.white);
        const blackPlayerInfo = await getUserInformation(data.black);

        if (accountService.getUserId() === data.white) {
            userId = data.white;
            opponentId = data.black;
            playStartAnimation(
                whitePlayerInfo,
                blackPlayerInfo
            );
        } else {
            userId = data.black;
            opponentId = data.white;
            playStartAnimation(
                blackPlayerInfo,
                whitePlayerInfo
            );
        }

    });

    socket.on('reconnect', async (data) => {
        const whitePlayerInfo = await getUserInformation(data.white);
        const blackPlayerInfo = await getUserInformation(data.black);
        await onGameReady(data, whitePlayerInfo, blackPlayerInfo);

        if (accountService.getUserId() === data.white) {
            userId = data.white;
            opponentId = data.black;
            playStartAnimation(whitePlayerInfo, blackPlayerInfo);
        } else {
            userId = data.black;
            opponentId = data.white;
            playStartAnimation(blackPlayerInfo, whitePlayerInfo);
        }

    });

    socket.on('update', (data) => handleUpdate(data));
    socket.on('matchmaking:waiting-for-players', () => { });

    socket.on("draw-asked", () => {
        showModal({
            message: "Opponent is asking for a draw",
            confirmLabel: "Accept",
            cancelLabel: "Deny",
            onConfirm: () => {
                socket.emit("accept-draw", { userId, gameId });
                closeModal();
            },
            onCancel: () => socket.emit("deny-draw", { userId, gameId }),
        });
        whitePlayerInfoComponent.stopTimer();
        blackPlayerInfoComponent.stopTimer();
    });

    socket.on("draw-denied", () => {
        notification.show("Draw Denied !", 'success');
        closeModal();
        whitePlayerInfoComponent.startTimer();
        blackPlayerInfoComponent.startTimer();
    });
}

async function onGameReady(data, whitePlayerInfo, blackPlayerInfo) {
    waiting_room.style.display = "none";
    game_container.style.filter = "none";
    gameId = data.gameId;

    setPlayerColor(data.white, data.black);

    whitePlayerInfo ??= await getUserInformation(data.white);
    blackPlayerInfo ??= await getUserInformation(data.black);

    whitePlayerInfoComponent.setPlayerInfo(whitePlayerInfo);
    blackPlayerInfoComponent.setPlayerInfo(blackPlayerInfo);

    await handleUpdate(data);
}

async function rematch() {
    try {
        const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, opponentId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        notificationService.notify("Rematch request sent", 'success')
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

function setupBoardEvents() {
    boardComponent.addEventListener("action", (e) => {
        e.detail.userId = userId;
        e.detail.gameType = GAME_TYPE;

        // Append rotation from the right inventory for PLACE actions
        if (e.detail.action.split("/")[0] === "PLACE") {
            const activePlayer = boardComponent.colorTurn === COLORS.WHITE
                ? whitePlayerInfoComponent
                : blackPlayerInfoComponent;
            const selectedCell = activePlayer.getSelectedInventoryCell();
            if (!selectedCell) return;
            e.detail.action += `,${selectedCell.direction}`;
        }

        whitePlayerInfoComponent.clearRotationCell();
        blackPlayerInfoComponent.clearRotationCell();

        socket.emit("action", e.detail);
    });

    boardComponent.addEventListener("piece-selected", (e) => {
        const target = e.detail.color === COLORS.WHITE ? whitePlayerInfoComponent
            : e.detail.color === COLORS.BLACK ? blackPlayerInfoComponent
                : null;
        if (target) target.setSelectedPiece(e.detail);
        else console.log("[Game] - Invalid Selection");
    });

    boardComponent.addEventListener("clear-rotation-cell", () => {
        whitePlayerInfoComponent.clearRotationCell();
        blackPlayerInfoComponent.clearRotationCell();
    });
}

function setupControls() {
    leave_btn.addEventListener("click", () => {
        showModal({
            message: "Leave the game ?",
            confirmLabel: "Leave",
            cancelLabel: "Cancel",
            onConfirm: () => {
                socket.emit("leave", { gameType: GAME_TYPE, userId, gameId });
                window.location.replace(`/`);
            },
        });
    });

    chat_btn.addEventListener("click", () => {
        if (!gameId) return;
        const chat = document.querySelector('.chat-container');
        chat.classList.remove("slide-out");
        chat.classList.add("slide-in");
    });

    leave_chat_btn.addEventListener("click", () => {
        if (!gameId) return;
        const chat = document.querySelector('.chat-container');
        chat.classList.remove("slide-in");
        chat.classList.add("slide-out");
    });
}


function showModal({ message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
    modal_message.textContent = message;
    modal_confirm.textContent = confirmLabel;
    modal_cancel.textContent = cancelLabel;

    modal.classList.remove('waiting');

    // Replace buttons to clear old listeners
    const newConfirm = modal_confirm.cloneNode(true);
    modal_confirm.replaceWith(newConfirm);
    modal_confirm = newConfirm;

    const newCancel = modal_cancel.cloneNode(true);
    modal_cancel.replaceWith(newCancel);
    modal_cancel = newCancel;

    modal_confirm.addEventListener('click', () => onConfirm());
    modal_cancel.addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });

    modal.classList.add('active');
}

function setModalWaiting() {
    modal.classList.add('waiting');
}

function closeModal() {
    modal.classList.remove('active');
}


function setupPlayerInfoEvents(playerInfoComponent) {
    playerInfoComponent.addEventListener("rotate", (e) =>
        boardComponent.rotate(e.detail.color, e.detail.direction)
    );
    playerInfoComponent.addEventListener("select-inventory-piece", () =>
        boardComponent.showPlaceCases()
    );
    playerInfoComponent.addEventListener("clear-interaction-canvas", () => {
        if (playerInfoComponent.color === boardComponent.colorTurn) {
            boardComponent.hidePlaceCases();
        }
    });
}

function setupEndMessage(endMessage) {
    endMessage.setGameType(GAME_TYPE);
    endMessage.addEventListener("play-again", () => startNewGame());
    endMessage.addEventListener("quit", () => window.location.replace(`/`));
    endMessage.addEventListener("rematch", async () => rematch())
}

function playStartAnimation(whitePlayerInfo, blackPlayerInfo) {
    const imgWhite = new Image();
    const imgBlack = new Image();
    imgWhite.src = whitePlayerInfo.picture.picture;
    imgBlack.src = blackPlayerInfo.picture.picture;

    Promise.all([
        new Promise((res) => { imgWhite.onload = imgWhite.onerror = res; }),
        new Promise((res) => { imgBlack.onload = imgBlack.onerror = res; }),
    ]).then(() => _playAnimation(whitePlayerInfo, blackPlayerInfo));
}

function _playAnimation(whitePlayerInfo, blackPlayerInfo) {
    document.querySelector('#white-animation-picture').src = whitePlayerInfo.picture.picture;
    document.querySelector('#black-animation-picture').src = blackPlayerInfo.picture.picture;
    document.querySelector("#white-username").textContent = whitePlayerInfo.username;
    document.querySelector("#black-username").textContent = blackPlayerInfo.username;

    const container = document.querySelector('.start-animation-container');
    const whiteAnim = document.querySelector('.white-animation');
    const blackAnim = document.querySelector('.black-animation');

    container.style.display = "flex";
    whiteAnim.classList.add("slide-up");
    blackAnim.classList.add("slide-down");

    setTimeout(() => container.style.opacity = '0', 2400);
    setTimeout(() => {
        container.style.display = 'none';
        container.style.opacity = '1';
        whiteAnim.classList.remove("slide-up");
        blackAnim.classList.remove("slide-down");
        document.querySelector("#white-username").textContent = "";
        document.querySelector("#black-username").textContent = "";
    }, 3100);
}


async function handleUpdate(data) {
    const isStarting = data.turnCount <= 0;

    await updatePlayerInfo(whitePlayerInfoComponent, data.colorTurn, data.white_inventory, data.white_time, isStarting);
    await updatePlayerInfo(blackPlayerInfoComponent, data.colorTurn, data.black_inventory, data.black_time, isStarting);

    console.log("[GAME] - Update received");
    await boardComponent.updateBoard(data);

    if (data.status !== "CONTINUE") {
        console.log("[GAME] - Game Over:", data.status);
        closeModal();
        endMessage.loadMessage(data.status);
        whitePlayerInfoComponent.stopTimer();
        blackPlayerInfoComponent.stopTimer();
    }
}

async function updatePlayerInfo(playerInfo, colorTurn, inventory, time, isStarting = false) {
    playerInfo.updateInventory(inventory);
    playerInfo.updateTimer(time);
    await playerInfo.setColorTurn(colorTurn);
    if (!isStarting) playerInfo.startTimer();
}

async function startNewGame() {
    const params = new URLSearchParams(window.location.search);
    const gameMode = parseInt(params.get('time')) || 600;

    socket.emit("join", { gameType: GAME_TYPE, userId, gameMode });

    waiting_room.style.display = "flex";
    game_container.style.filter = "blur(6px)";

    boardComponent.clear();
    await whitePlayerInfoComponent.clear();
    await blackPlayerInfoComponent.clear();

    game_chat.clearContent();
    endMessage.clear();
}

function setPlayerColor(white_id, black_id) {
    const main = document.querySelector('main');
    let color = null;

    if (white_id === userId) {
        color = COLORS.WHITE;
        blackPlayerInfoComponent.disableRotation();
        main.classList.remove('flipped');
    } else if (black_id === userId) {
        color = COLORS.BLACK;
        whitePlayerInfoComponent.disableRotation();
        main.classList.add('flipped');
    }

    boardComponent.setPlayerColor(color);
    whitePlayerInfoComponent.setPlayerColor(color);
    blackPlayerInfoComponent.setPlayerColor(color);
    endMessage.setColor(color);
}



async function getUserInformation(userId) {
    try {
        const response = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`Error while getting user information: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch user information:', error);
    }
}


async function setupGameChat() {
    game_chat = document.querySelector('chat-component');

    const gameChatContent = await gameService.fetchGameChat(gameId);
    game_chat.setChat(gameChatContent);

    game_chat.addEventListener("send-message", async (e) => {
        e.detail.message.userId = userId;
        e.detail.message.gameId = gameId;

        try {
            const req = await accountService.authFetch(`${GATEWAY_URL}/api/chat/game/${gameId}`, {
                method: "POST",
                body: JSON.stringify(e.detail.message),
                headers: { 'Content-Type': 'application/json' },
            });
            if (!req.ok) {
                const error = new Error('HTTP Error');
                error.status = req.status;
                throw error;
            }
        } catch (error) {
            if (error.status === 422) {
                game_chat.show_invalid_message();
            } else {
                console.log("Failed to send the message", error);
                notify("Failed to send the message", "error");
            }
        }
    });

    socket.on('new-message', (data) => game_chat.addNewMessage(data));
    socket.on('invalid-mesage', () => game_chat.show_invalid_message());

    game_chat.addEventListener("ask-draw", () => {
        closeMobileChat();
        showModal({
            message: "Ask for a Draw ?",
            confirmLabel: "Continue",
            cancelLabel: "Cancel",
            onConfirm: () => {
                setModalWaiting();
                socket.emit("ask-draw", { userId, gameId });
                notification.show("Asked for a draw", 'success');
                whitePlayerInfoComponent.stopTimer();
                blackPlayerInfoComponent.stopTimer();
            },
        });
    });

    game_chat.addEventListener("ask-forfeit", () => {
        closeMobileChat();
        showModal({
            message: "Forfeit the game ?",
            confirmLabel: "Forfeit",
            cancelLabel: "Cancel",
            onConfirm: () => socket.emit("forfeit", { userId, gameId }),
        });
    });
}

function closeMobileChat() {
    if (!window.matchMedia('(max-width: 64em)').matches) return;
    const chat = document.querySelector('.chat-container');
    chat.classList.remove("slide-in");
    chat.classList.add("slide-out");
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}