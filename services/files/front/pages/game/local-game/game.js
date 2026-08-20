import { GATEWAY_URL } from "../../../env.js";
import * as accountService from "../../../services/account-service.js";
import { COLORS } from "../../../enum/Colors.js";
import * as gameService from "../../../services/game-service.js";

let socket;
let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;
let endMessage;
let userId;
let GAME_TYPE = "LOCAL";
let gameId;

let leave_btn;

let modal;
let modal_message;
let modal_confirm;
let modal_cancel;

// Initialisation
async function init() {

    userId = accountService.getUserId();

    // Connexion socket
    socket = gameService.getSocketConnection();

    // Attendre que le composant game-board soit prêt
    await waitForBoard();
}

async function waitForBoard() {
    // Wait for the custom element to be defined
    await customElements.whenDefined('game-board');
    await customElements.whenDefined('player-info');

    boardComponent = document.querySelector('game-board');

    whitePlayerInfoComponent = document.querySelector('.white');
    blackPlayerInfoComponent = document.querySelector('.black');

    leave_btn = document.querySelector(".leave-btn");
    modal = document.getElementById('game-modal');
    modal_message = document.getElementById('modal-message');
    modal_confirm = document.getElementById('modal-confirm');
    modal_cancel = document.getElementById('modal-cancel');
    modal_cancel.addEventListener('click', () => closeModal());

    endMessage = document.querySelector('end-message');

    // Wait for the component to be fully ready
    await Promise.all([
        boardComponent.readyPromise,
        whitePlayerInfoComponent.readyPromise,
        blackPlayerInfoComponent.readyPromise,
    ]);

    await setupGame(boardComponent);
}

async function setupGame() {

    // Écouter les événements du serveur
    socket.on('start', async (data) => { gameId = data.gameId, await handleUpdate(data, true) });
    socket.on('reconnect', async (data) => { console.log("reconnect"); gameId = data.gameId; await handleUpdate(data) });
    socket.on('update', async (data) => await handleUpdate(data));

    // Setup les composants

    await whitePlayerInfoComponent.disableName();
    await whitePlayerInfoComponent.disableElo();
    await whitePlayerInfoComponent.disableProfilePicture();
    await whitePlayerInfoComponent.setColor(COLORS.WHITE);

    await blackPlayerInfoComponent.disableName();
    await blackPlayerInfoComponent.disableElo();
    await blackPlayerInfoComponent.disableProfilePicture();
    await blackPlayerInfoComponent.setColor(COLORS.BLACK);

    leave_btn.addEventListener("click", () => {
        showModal({
            message: "Leave the game?",
            confirmLabel: "Leave",
            onConfirm: () => {
                socket.emit("leave", { gameType: GAME_TYPE, userId, gameId });
                window.location.replace(`/`);
            }
        });
    });

    setupPlayerInfoEvents(whitePlayerInfoComponent);
    setupPlayerInfoEvents(blackPlayerInfoComponent);
    setupBoardComponentEvents(boardComponent);
    setupEndMessage(endMessage);

    // Démarrer une nouvelle partie
    startNewGame();
}

function showModal({ message, confirmLabel, onConfirm }) {
    modal_message.textContent = message;
    modal_confirm.textContent = confirmLabel;

    // Clone le bouton pour supprimer les anciens listeners
    const newConfirm = modal_confirm.cloneNode(true);
    modal_confirm.replaceWith(newConfirm);
    modal_confirm = newConfirm;

    modal_confirm.addEventListener('click', () => {
        closeModal();
        onConfirm();
    });

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

function setupPlayerInfoEvents(playerInfoComponent) {
    playerInfoComponent.addEventListener("rotate", e => boardComponent.rotate(e.detail.color, e.detail.direction));
    playerInfoComponent.addEventListener("select-inventory-piece", e => boardComponent.showPlaceCases());
    playerInfoComponent.addEventListener("clear-interaction-canvas", e => {
        if (playerInfoComponent.playerColor === boardComponent.colorTurn) boardComponent.hidePlaceCases()
    });
}


function setupEndMessage(endMessage) {
    endMessage.setGameType("LOCAL");
    endMessage.addEventListener("play-again", () => startNewGame())
    endMessage.addEventListener("quit", () => { window.location.replace(`/`); })
}

function setupBoardComponentEvents(boardComponent) {
    // Component event setup
    boardComponent.addEventListener("action", e => {

        // Adding client information
        e.detail.userId = userId;
        e.detail.gameType = GAME_TYPE;

        // Adding the rotation from the right inventory
        if (e.detail.action.split("/")[0] === "PLACE") {
            if (boardComponent.colorTurn === COLORS.WHITE && whitePlayerInfoComponent.getSelectedInventoryCell())
                e.detail.action += `,${whitePlayerInfoComponent.getSelectedInventoryCell().direction}`;
            else if (boardComponent.colorTurn === COLORS.BLACK && blackPlayerInfoComponent.getSelectedInventoryCell())
                e.detail.action += `,${blackPlayerInfoComponent.getSelectedInventoryCell().direction}`;
            else {
                return;
            }
        }

        // Clearing the cells whatever the colorTurn is
        whitePlayerInfoComponent.clearRotationCell();
        blackPlayerInfoComponent.clearRotationCell();

        // Emit the final action

        socket.emit("action", e.detail);
    });


    boardComponent.addEventListener("piece-selected", e => {
        switch (e.detail.color) {
            case COLORS.WHITE:
                whitePlayerInfoComponent.setSelectedPiece(e.detail)
                break;
            case COLORS.BLACK:
                blackPlayerInfoComponent.setSelectedPiece(e.detail)
                break;
            default:
                console.log("[GAME] - Invalid Selection");
                break;
        }
    })

    boardComponent.addEventListener("clear-rotation-cell", e => {
        // Peut importe la couleur on clear le contenu
        whitePlayerInfoComponent.clearRotationCell();
        blackPlayerInfoComponent.clearRotationCell();
    })
}

async function handleUpdate(data, isStarting = false) {

    gameId = data.gameId;

    await updatePlayerInfo(whitePlayerInfoComponent, data.colorTurn, data.white_inventory, data.white_time, isStarting);
    await updatePlayerInfo(blackPlayerInfoComponent, data.colorTurn, data.black_inventory, data.black_time, isStarting);

    await updateBoard(data);

    if (data.status !== "CONTINUE") {
        console.log("[GAME] - Game Over: ", data.status);

        setTimeout(() => endMessage.loadMessage(data.status), 500);

    };


}

async function updatePlayerInfo(playerInfo, colorTurn, inventory, time, isStarting = false) {
    playerInfo.updateInventory(inventory);
    playerInfo.setPlayerColor(colorTurn);
    playerInfo.updateTimer(time);
    await playerInfo.setColorTurn(colorTurn);
    if (!isStarting) {
        playerInfo.startTimer();
    }
}

async function updateBoard(data) {
    boardComponent.setPlayerColor(data.colorTurn);
    await boardComponent.updateBoard(data);
}

function startNewGame() {
    const params = new URLSearchParams(window.location.search);
    const gameMode = parseInt(params.get('time')) || 600;

    socket.emit("join", { gameType: GAME_TYPE, userId: userId, gameMode: gameMode });
    boardComponent.clearSelection();
    endMessage.clear();
}

// Lancer l'initialisation quand le DOM est prêt
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();