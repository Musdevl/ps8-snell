import { GATEWAY_URL } from "../../../env.js";
import * as accountService from "../../../services/account-service.js";
import { COLORS } from "../../../enum/Colors.js";


let socket;
let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;
let endMessage;
let userId = accountService.getUserId();
let GAME_TYPE = "AI";
let gameId;

let leave_btn;

let modal;
let modal_message;
let modal_confirm;
let modal_cancel;

await accountService.checkAuth();

// Initialisation
async function init() {

    // Connexion socket
    socket = io(`${GATEWAY_URL}/game`);
    socket.on('connect', () => { console.log('[Game] Socket connected:', socket.id); });
    socket.on('connect_error', (error) => { console.error('[Game] Socket connection error:', error); });

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

    // Wait for all components to be fully ready
    await Promise.all([
        boardComponent.readyPromise,
        whitePlayerInfoComponent.readyPromise,
        blackPlayerInfoComponent.readyPromise,
    ]);

    await setupGame(boardComponent);
}

async function setupGame() {
    // Écouter les événements du serveur
    setupSocketEvents();

    // Setup les composants


    await whitePlayerInfoComponent.setColor(COLORS.WHITE);

    await blackPlayerInfoComponent.setColor(COLORS.BLACK);

    leave_btn.addEventListener("click", () => {
        showModal({
            message: "Leave the game?",
            confirmLabel: "Leave",
            onConfirm: () => {
                socket.emit("leave", { gameType: GAME_TYPE, userId, gameId });
                window.location.replace(`/pages/ais/index.html`);
            }
        });
    });

    // Setting up 
    setupPlayerInfoEvents(whitePlayerInfoComponent);
    setupPlayerInfoEvents(blackPlayerInfoComponent);
    setupBoardComponentEvents(boardComponent);
    setupEndMessage(endMessage);

    // Démarrer une nouvelle partie
    startNewGame();
}


// ─── Application ordonnée des états de partie ────────────────────────────────
// Quand on joue les noirs, le serveur envoie deux évènements coup sur coup :
// "start" avec la position de départ, puis "update" avec le coup de l'IA.
// Le handler de "start" doit charger les deux cartes joueur, donc il rend la
// main le temps de deux requêtes HTTP — et applique la position de départ
// APRÈS le coup de l'IA, qui est alors écrasé. Contre une IA rapide ça arrive
// systématiquement, contre une IA lente jamais, d'où le bug intermittent.
//
// On sérialise donc les rendus dans une chaîne de promesses (deux
// updateBoard concurrents s'entremêleraient de toute façon, chacun animant
// depuis une grille que l'autre est en train de remplacer), et on ignore tout
// état plus ancien que celui déjà affiché.

let renderChain = Promise.resolve();
let renderedGameId = null;
let renderedTurnCount = -1;

function queueGameState(data) {
    renderChain = renderChain
        .then(() => applyGameState(data))
        .catch(error => console.error('[Game] Failed to apply game state:', error));
    return renderChain;
}

async function applyGameState(data) {
    // Un tour antérieur à celui affiché est une trame en retard. Une nouvelle
    // partie repart d'un autre gameId, donc son tour 0 n'est jamais rejeté.
    if (data.gameId === renderedGameId && data.turnCount < renderedTurnCount) return;

    renderedGameId = data.gameId;
    renderedTurnCount = data.turnCount;
    await handleUpdate(data);
}

function setupSocketEvents() {
    socket.on('start', async (data) => {

        gameId = data.gameId;
        await onGameReady(data)
    })

    socket.on('reconnect', async (data) => {

        gameId = data.gameId;
        await onGameReady(data)

    })

    socket.on('update', (data) => queueGameState(data));
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

async function getAiInformation(aiId) {
    try {
        const response = await accountService.authFetch(`${GATEWAY_URL}/api/ais/${aiId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`Error while getting user information: ${response.status}`);
        const res = await response.json();
        return {
            _id: res.ai.id,
            username: res.ai.name,
            picture: { picture: res.ai.path }
        }
    } catch (error) {
        console.error('Failed to fetch user information:', error);
    }
}

async function onGameReady(data, whitePlayerInfo, blackPlayerInfo) {
    gameId = data.gameId;

    await setPlayerColor(data.white, data.black);

    // La position part au rendu avant les requêtes ci-dessous : sinon le coup
    // que l'IA joue pendant ces requêtes serait écrasé par la position de
    // départ. Les cartes joueur se remplissent ensuite, elles ne bloquent
    // plus l'affichage du plateau.
    queueGameState(data);

    if (userId === data.white) {
        whitePlayerInfo ??= await getUserInformation(data.white);
        blackPlayerInfo ??= await getAiInformation(data.black);
    } else {
        blackPlayerInfo ??= await getUserInformation(data.black);
        whitePlayerInfo ??= await getAiInformation(data.white);
    }

    whitePlayerInfoComponent.setPlayerInfo(whitePlayerInfo);
    whitePlayerInfoComponent.disableElo();
    whitePlayerInfoComponent.disableTimer();

    blackPlayerInfoComponent.setPlayerInfo(blackPlayerInfo);
    blackPlayerInfoComponent.disableElo();
    blackPlayerInfoComponent.disableTimer();
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
        if (playerInfoComponent.color === boardComponent.colorTurn) {
            boardComponent.hidePlaceCases()
        }
    });
}

function setupEndMessage(endMessage) {
    endMessage.setGameType("AI");
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
            const whiteDirection = whitePlayerInfoComponent.getSelectedInventoryCellDirection();
            const blackDirection = blackPlayerInfoComponent.getSelectedInventoryCellDirection();

            if (boardComponent.colorTurn === COLORS.WHITE && whiteDirection !== null)
                e.detail.action += `,${whiteDirection}`;
            else if (boardComponent.colorTurn === COLORS.BLACK && blackDirection !== null)
                e.detail.action += `,${blackDirection}`;
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
                console.log("GAME - Invalid Selection");
                break;
        }
    })

    boardComponent.addEventListener("clear-rotation-cell", e => {
        // Peut importe la couleur on clear le contenu
        whitePlayerInfoComponent.clearRotationCell();
        blackPlayerInfoComponent.clearRotationCell();
    })
}

async function handleUpdate(data) {

    await updatePlayerInfo(whitePlayerInfoComponent, data.colorTurn, data.white_inventory, data.white_time)
    await updatePlayerInfo(blackPlayerInfoComponent, data.colorTurn, data.black_inventory, data.black_time)

    await boardComponent.updateBoard(data);

    await setPlayerColor(data.white, data.black, boardComponent);


    if (data.status !== "CONTINUE") {
        endMessage.loadMessage(data.status);
    };
}

async function updatePlayerInfo(playerInfo, colorTurn, inventory, time) {
    playerInfo.updateInventory(inventory);
    playerInfo.updateTimer(time);
    await playerInfo.setColorTurn(colorTurn);
}

function startNewGame() {

    const params = new URLSearchParams(window.location.search);
    const aiId = params.get("id") ?? 1;
    const playerColor = params.get("color") ?? "white";

    socket.emit("join", { gameType: GAME_TYPE, userId: userId, aiId: aiId, playerColor: playerColor });
    boardComponent.clearSelection();
    endMessage.clear();
}

async function setPlayerColor(white_id, black_id) {
    const main = document.querySelector('main');
    let color = null;
    if (white_id === userId) {
        color = COLORS.WHITE;
        blackPlayerInfoComponent.disableRotation();
        main.classList.remove('flipped');
    }
    else if (black_id === userId) {
        color = COLORS.BLACK;
        whitePlayerInfoComponent.disableRotation();
        // main.flipped existe deja dans shared/game.css : il renvoie le
        // panneau du joueur de son cote, comme en multijoueur.
        main.classList.add('flipped');
        blackPlayerInfoComponent.reverse();
    }
    boardComponent.setPlayerColor(color);
    boardComponent.setBoardOrientation(color);
    whitePlayerInfoComponent.setPlayerColor(color);
    blackPlayerInfoComponent.setPlayerColor(color);
    await endMessage.setColor(color);
}

// Lancer l'initialisation quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}