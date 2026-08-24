import { GATEWAY_URL } from "../../../env.js";
import { COLORS } from "../../../enum/Colors.js";
import * as uint16Utils from "../../../utils/Uint16Utils.js";
import { authFetch } from "../../../services/account-service.js";

const params = new URLSearchParams(window.location.search);
const puzzle_id = params.get("id");

let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;

let leave_btn;

let notification;

let modal;
let modal_message;
let modal_confirm;
let modal_cancel;

let puzzle_step_index = 0;

let puzzle;

const incorrect_action = new Audio(`/assets/sounds/illegal.mp3`);
const correct_action = new Audio(`/assets/sounds/correct.mp3`);

// Initialisation
async function init() {
    // Attendre que le composant game-board soit prêt
    await fetchPuzzle();
    await waitForBoard();
    await setupGame();
    await startPuzzle();
}

async function fetchPuzzle() {
    const params = new URLSearchParams(window.location.search);
    const puzzle_id = params.get("id");

    try {
        const response = await authFetch(`${GATEWAY_URL}/api/game/puzzles/${puzzle_id}`)
        const res = await response.json();
        puzzle = res.puzzle;
        puzzle.game_states = puzzle.game_states.map(state => uint16Utils.normalizeGameState(state));
    } catch (error) {
        window.location.replace(`/pages/puzzles`);
        console.log(error);
    }
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
    const puzzle_title = document.querySelector('.puzzle-title');
    puzzle_title.innerHTML += `
    <div class="puzzle-ico-container">
                            <img class="puzzle-ico" src="/assets/puzzle-piece-${puzzle.difficulty}.svg">
                            <span class="puzzle-number">${puzzle.id}</span>
                        </div>
                        <div class="puzzle-name">
                        ${puzzle.name}
                        </div>
    </div>
    `;

    setupBoardComponentEvents(boardComponent);

    await setupPlayerInfoForPuzzle(whitePlayerInfoComponent, COLORS.WHITE);

    whitePlayerInfoComponent.setPlayerColor(COLORS.WHITE);
    setupPlayerInfoEvents(whitePlayerInfoComponent);
    await setupPlayerInfoForPuzzle(blackPlayerInfoComponent, COLORS.BLACK);
    boardComponent.setPlayerColor(COLORS.WHITE);

    leave_btn.addEventListener("click", () => {
        showModal({
            message: "Leave puzzle ?",
            confirmLabel: "Leave",
            cancelLabel: "Cancel",
            onConfirm: () => {
                window.location.replace(`/pages/puzzles`);
            }
        });
    });
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

        if (action === puzzle.steps[puzzle_step_index]) {
            nextPuzzleStep();
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


async function setupPlayerInfoForPuzzle(playerInfo, color) {
    await playerInfo.setColor(color);
    playerInfo.disableElo();
    playerInfo.disableProfilePicture();
    playerInfo.disableName();
    playerInfo.disableTimer()
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

    console.log("[GAME] - Update received: ", data);

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

async function startPuzzle() {
    boardComponent.clear();
    await handleUpdate(puzzle.game_states[puzzle_step_index], true);

}

function playSound(sound) {
    sound.play().catch(() => { });
}

async function nextPuzzleStep() {

    puzzle_step_index++;

    await handleUpdate(puzzle.game_states[puzzle_step_index], false)

    if (puzzle_step_index >= puzzle.steps.length - 1) {
        showModal({
            message: "Congratulations, you finished the puzzle !",
            confirmLabel: "Leave",
            cancelLabel: "Next",
            onConfirm: () => {
                window.location.replace(`/`);
            },
            onCancel: () => {
                window.location.replace(`/pages/game/puzzle/index.html?id=${++puzzle.id}`)
            }
        });

        return;
    }

    const nextColorTurn = puzzle.game_states[puzzle_step_index].colorTurn

    if (nextColorTurn !== puzzle.playerColor) {
        puzzle_step_index++;
        await handleUpdate(puzzle.game_states[puzzle_step_index], false)
    }
}

// Lancer l'initialisation quand le DOM est prêt
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();