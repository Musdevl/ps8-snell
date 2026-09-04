import { GATEWAY_URL } from "../../../env.js";
import { COLORS } from "../../../enum/Colors.js";
import * as uint16Utils from "../../../utils/Uint16Utils.js";
import { TUTORIAL_STEPS } from "../../../utils/TutorialSteps.js";
import { authFetch } from "../../../services/account-service.js";

let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;

let leave_btn;

let notification;

let modal;
let modal_message;
let modal_confirm;
let modal_cancel;

let state_index = 0;
let game_states = [];


let tutorial_index = 0;
let tutorial_steps = TUTORIAL_STEPS;
let tutorial_container;
let tutorial_message;
let tutorial_next;
let tutorial_previous;

const incorrect_action = new Audio(`/assets/sounds/illegal.mp3`);
const correct_action = new Audio(`/assets/sounds/correct.mp3`);

// Initialisation
async function init() {
    // Attendre que le composant game-board soit prêt
    await waitForBoard();
    await setupGame();
    await startTutorial();
}


async function waitForBoard() {
    // Wait for the custom element to be defined
    await customElements.whenDefined('game-board');

    boardComponent = document.querySelector('game-board');

    whitePlayerInfoComponent = document.querySelector('.white');
    blackPlayerInfoComponent = document.querySelector('.black');

    leave_btn = document.querySelector(".leave-btn");

    modal = document.getElementById('game-modal');
    modal_message = document.getElementById('modal-message');
    modal_confirm = document.getElementById('modal-confirm');
    modal_cancel = document.getElementById('modal-cancel');
    modal_cancel.addEventListener('click', () => closeModal());

    notification = document.querySelector('notification-bar');


    // Wait for all components to be fully ready
    await Promise.all([
        boardComponent.readyPromise,
        whitePlayerInfoComponent.readyPromise,
        blackPlayerInfoComponent.readyPromise,
    ]);

    console.log('[Game] Board component ready');
}

async function setupGame() {

    // Setup les composants

    setupBoardComponentEvents(boardComponent);

    await setupPlayerInfoForTutorial(whitePlayerInfoComponent, COLORS.WHITE);

    whitePlayerInfoComponent.setPlayerColor(COLORS.WHITE);
    setupPlayerInfoEvents(whitePlayerInfoComponent);

    await setupPlayerInfoForTutorial(blackPlayerInfoComponent, COLORS.BLACK);

    boardComponent.setPlayerColor(COLORS.WHITE);

    leave_btn.addEventListener("click", () => {
        showModal({
            message: "Leave the tutorial ?",
            confirmLabel: "Leave",
            cancelLabel: "Cancel",
            onConfirm: () => {
                window.location.replace(`/`);
            }
        });
    });

    const res = await fetch(`${GATEWAY_URL}/api/game/tutorial`);
    const raw = await res.json();
    game_states = raw.grid_states.map(state => uint16Utils.normalizeGameState(state));

    tutorial_container = document.querySelector('.tutorial-container');
    tutorial_message = document.querySelector('#tutorial-message');
    tutorial_next = document.querySelector('.next-btn')
    tutorial_previous = document.querySelector('.previous-btn');

    tutorial_next.addEventListener('click', async () => await nextTutorielStep());

    tutorial_previous.addEventListener('click', async () => await previousTutorielStep());

}

async function previousTutorielStep() {
    if (tutorial_index <= 0) return;

    const leavingStep = tutorial_steps[tutorial_index]; // step qu'on quitte
    tutorial_index--;
    await renderTutorialStep();

    const landingStep = tutorial_steps[tutorial_index]; // step où on atterrit

    const isLeavingBlack = leavingStep.color === COLORS.BLACK;
    const isLandingOnWhiteAction = landingStep.expectedAction !== "NONE" && landingStep.color === COLORS.WHITE;

    if (isLeavingBlack) {
        state_index--;
        await handleUpdate(game_states[state_index], true);
    }

    if (isLandingOnWhiteAction) {
        state_index--;
        await handleUpdate(game_states[state_index], true);
    }

    applyStepHighlight(landingStep);

    tutorial_next.disabled = landingStep.blocking;
}

async function nextTutorielStep() {
    if (tutorial_index >= tutorial_steps.length - 1) {

        showModal({
            message: "Congratulations, you finished the tutorial !",
            confirmLabel: "Leave",
            cancelLabel: "Cancel",
            onConfirm: () => {
                window.location.replace(`/`);
            }
        });

        return;
    }

    const currentStep = tutorial_steps[tutorial_index];
    tutorial_index++;
    await renderTutorialStep();

    const nextStep = tutorial_steps[tutorial_index];

    const isWhiteAction = currentStep.expectedAction !== "NONE" && currentStep.color === COLORS.WHITE;
    const isArrivingOnBlack = nextStep?.color === COLORS.BLACK;

    if (isWhiteAction) {
        state_index++;
        await handleUpdate(game_states[state_index], true);
    }

    if (isArrivingOnBlack) {
        state_index++;
        await handleUpdate(game_states[state_index], true);
    }

    const step = tutorial_steps[tutorial_index];

    applyStepHighlight(step);

    tutorial_next.disabled = step.blocking;
}


function setupBoardComponentEvents(boardComponent) {
    // Component event setup
    boardComponent.addEventListener("action", e => {
        let action = e.detail.action;

        if (action.split("/")[0] === "PLACE") {
            if (boardComponent.colorTurn === COLORS.WHITE && whitePlayerInfoComponent.getSelectedInventoryCell())
                action += `,${whitePlayerInfoComponent.getSelectedInventoryCell().direction}`;
            else if (boardComponent.colorTurn === COLORS.BLACK && blackPlayerInfoComponent.getSelectedInventoryCell())
                action += `,${blackPlayerInfoComponent.getSelectedInventoryCell().direction}`;
            else return;
        }

        whitePlayerInfoComponent.clearRotationCell();
        blackPlayerInfoComponent.clearRotationCell();

        if (action === tutorial_steps[tutorial_index].expectedAction) {
            // Le coup demandé vient d'être joué : on éteint le projecteur tout
            // de suite. Sinon le plateau resterait assombri pendant la pose de
            // la pièce puis tout le passage du laser — c'est-à-dire pendant
            // exactement ce qu'on veut donner à voir. L'étape suivante
            // rallumera le sien si elle en a un.
            boardComponent.clearHighlightedCells();
            nextTutorielStep();
            playSound(correct_action);
        }
        else {
            playSound(incorrect_action)
        }
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


async function setupPlayerInfoForTutorial(playerInfo, color) {
    await playerInfo.setColor(color);
    playerInfo.disableElo();
    playerInfo.disableProfilePicture();
    playerInfo.disableName();
}

function setupPlayerInfoEvents(playerInfoComponent) {
    playerInfoComponent.addEventListener("rotate", e => boardComponent.rotate(e.detail.color, e.detail.direction));
    playerInfoComponent.addEventListener("select-inventory-piece", e => boardComponent.showPlaceCases());
    playerInfoComponent.addEventListener("clear-interaction-canvas", e => {
        if (playerInfoComponent.playerColor === boardComponent.colorTurn) boardComponent.hidePlaceCases()
    });
}

function showModal({ message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
    modal_message.textContent = message;
    modal_confirm.textContent = confirmLabel;
    modal_cancel.textContent = cancelLabel;

    const newConfirm = modal_confirm.cloneNode(true);
    modal_confirm.replaceWith(newConfirm);
    modal_confirm = newConfirm;

    const newCancel = modal_cancel.cloneNode(true);
    modal_cancel.replaceWith(newCancel);
    modal_cancel = newCancel;

    modal_confirm.addEventListener('click', () => {
        onConfirm(); // ne ferme plus automatiquement
    });

    modal_cancel.addEventListener('click', () => {
        closeModal();
        if (onCancel) onCancel();
    });

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}



async function handleUpdate(data, isStarting = false) {

    console.log("[GAME] - Update received: ");

    await boardComponent.updateBoard(data);

    await updatePlayerInfo(whitePlayerInfoComponent, data.colorTurn, data.white_inventory, data.white_time, isStarting)
    await updatePlayerInfo(blackPlayerInfoComponent, data.colorTurn, data.black_inventory, data.black_time, isStarting)

}

async function updatePlayerInfo(playerInfo, colorTurn, inventory, time, isStarting = false) {
    playerInfo.updateInventory(inventory);
    await playerInfo.updateTimer(time);
    await playerInfo.setColorTurn(colorTurn);
    if (!isStarting) {
        playerInfo.startTimer();
    }
}

async function startTutorial() {
    boardComponent.clear();
    await handleUpdate(game_states[state_index], true);
    await renderTutorialStep();
    applyStepHighlight(tutorial_steps[tutorial_index]);

}


/**
 * Coup de projecteur de l'étape courante : le plateau s'assombrit, sauf les
 * cases concernées. Appelé APRÈS la mise à jour du plateau, parce que les
 * surlignages de type "piece" se lisent dans la position affichée.
 */
function applyStepHighlight(step) {
    const cells = resolveHighlightCells(step);

    if (cells.length === 0) {
        boardComponent.clearHighlightedCells();
        return;
    }

    boardComponent.highlightCells(cells);
}

/**
 * Les cases à mettre en avant pour une étape.
 *
 * Par défaut elles sont DÉDUITES de `expectedAction` : c'est ce qu'on demande
 * au joueur de faire, donc c'est exactement ce qu'il faut lui montrer, et les
 * deux ne peuvent pas se contredire quand on modifie le scénario. `highlight`
 * ne sert qu'aux étapes explicatives, qui n'attendent aucune action.
 */
function resolveHighlightCells(step) {
    if (!step) return [];

    const cellsFromAction = actionCells(step.expectedAction);
    if (cellsFromAction.length > 0) return cellsFromAction;

    const highlight = step.highlight;
    if (!highlight) return [];

    switch (highlight.type) {
        case "cells":
            return Array.isArray(highlight.cells) ? highlight.cells : [];

        case "cell":
            return [[highlight.row, highlight.col]];

        case "piece":
            return findPieceCells(highlight.piece, highlight.color);

        // "panel" désigne le panneau latéral, qui n'est pas sur le plateau.
        default:
            return [];
    }
}

/** Les cases citées par une action : "MOVE/54,53" → [[5,4], [5,3]]. */
function actionCells(expectedAction) {
    if (!expectedAction || expectedAction === "NONE") return [];

    const [type, coords] = expectedAction.split("/");
    if (!coords) return [];

    const [from, to] = coords.split(",");

    switch (type) {
        case "PLACE":
        case "ROTATE":
            // Le second membre est une direction, pas une case.
            return [parseCell(from)];

        case "MOVE":
        case "SWAP":
            return [parseCell(from), parseCell(to)];

        default:
            return [];
    }
}

const parseCell = (coords) => [Number(coords[0]), Number(coords[1])];

/** Toutes les cases occupées par un type de pièce d'une couleur donnée. */
function findPieceCells(pieceName, colorName) {
    const grid = boardComponent.gridState ?? [];
    const color = colorName === "black" ? COLORS.BLACK : COLORS.WHITE;
    const cells = [];

    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            const piece = grid[row][col];
            if (piece && piece.pieceName === pieceName && piece.color === color) {
                cells.push([row, col]);
            }
        }
    }

    return cells;
}

async function renderTutorialStep() {
    tutorial_message.classList.remove('slide-in');
    void tutorial_message.offsetWidth;
    tutorial_message.innerHTML = tutorial_steps[tutorial_index].message;
    tutorial_message.classList.add('slide-in');
}

function playSound(sound) {
    sound.play().catch(() => { });
}

// Lancer l'initialisation quand le DOM est prêt
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();