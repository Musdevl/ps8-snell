import { GATEWAY_URL } from "../../../env.js";
import { COLORS } from "../../../enum/Colors.js";
import * as accountService from "../../../services/account-service.js";
import * as uint16Utils from "../../../utils/Uint16Utils.js";

let boardComponent;
let whitePlayerInfoComponent;
let blackPlayerInfoComponent;

let leave_btn;

let modal;
let modal_message;
let modal_confirm;
let modal_cancel;

let gameId;

let notification;

let review_analytics;

let state_index = 0;

let game_states = [];

let white_player_id;
let black_player_id;

let isInPlayMode = false;

let evalBar;
let evalScores;

await accountService.checkAuth();

// Initialisation
async function init() {
    // Attendre que le composant game-board soit prêt
    await waitForBoard();
    await setupGame();
    evalScores = await generateEvaluationList();
    await startReview();

}


async function waitForBoard() {
    // Wait for the custom element to be defined
    await customElements.whenDefined('game-board');

    boardComponent = document.querySelector('game-board');
    evalBar = document.querySelector('evaluation-bar');

    whitePlayerInfoComponent = document.querySelector('.white');
    blackPlayerInfoComponent = document.querySelector('.black');

    leave_btn = document.querySelector(".leave-btn");

    review_analytics = document.querySelector("review-analytics");

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

    await whitePlayerInfoComponent.setColor(COLORS.WHITE);
    await blackPlayerInfoComponent.setColor(COLORS.BLACK);

    whitePlayerInfoComponent.disableRotation();
    blackPlayerInfoComponent.disableRotation();

    whitePlayerInfoComponent.disableTimer();
    blackPlayerInfoComponent.disableTimer();


    leave_btn.addEventListener("click", () => {
        showModal({
            message: "Leave the review ?",
            confirmLabel: "Leave",
            cancelLabel: "Cancel",
            onConfirm: () => {
                window.location.replace(`/`);
            }
        });
    });

    review_analytics.addEventListener("next", async () => {
        const next_index = getNextIndex();
        review_analytics.highlight_cell(next_index);
        await handleUpdate(game_states[next_index + 1]);
    })

    review_analytics.addEventListener("previous", async () => {
        const pres_index = getPreviousIndex();
        review_analytics.highlight_cell(pres_index);
        await handleUpdate(game_states[pres_index + 1]);
    })

    review_analytics.addEventListener("first", async () => {
        state_index = 0;
        review_analytics.highlight_cell(state_index);
        await handleUpdate(game_states[state_index + 1]);
    })

    review_analytics.addEventListener("last", async () => {
        state_index = game_states.length - 2
        review_analytics.highlight_cell(state_index);
        await handleUpdate(game_states[state_index + 1]);
    })

    review_analytics.addEventListener("go-to", async (e) => {
        state_index = e.detail.index;
        review_analytics.highlight_cell(state_index);
        await handleUpdate(game_states[state_index + 1]);
    })

    review_analytics.addEventListener("play", async (e) => {
        isInPlayMode = true;

        const playNext = async () => {
            if (!isInPlayMode) return;

            if (state_index >= game_states.length - 1) {
                isInPlayMode = false;
                review_analytics.pause();
                return;
            }

            const nextIndex = getNextIndex();
            review_analytics.highlight_cell(nextIndex - 1);
            await handleUpdate(game_states[nextIndex]);

            setTimeout(playNext, 1500);
        };

        setTimeout(playNext, 1500);
    })

    review_analytics.addEventListener("pause", async (e) => {
        isInPlayMode = false;
    })

    document.addEventListener("keydown", async (e) => {
        if (e.key === "ArrowLeft") {
            review_analytics.pause();
            const pres_index = getPreviousIndex();
            review_analytics.highlight_cell(pres_index);
            await handleUpdate(game_states[pres_index]);
        }
        if (e.key === "ArrowRight") {
            review_analytics.pause();
            const next_index = getNextIndex();
            review_analytics.highlight_cell(next_index);
            await handleUpdate(game_states[next_index]);
        }
        if (e.key === " ") {
            if (!isInPlayMode) {
                review_analytics.play();
            } else {
                review_analytics.pause();
            }
        }
    });

    // Setting up

    // Récuperer la review de la game et setup les params

    const splitedPathName = window.location.pathname.split("/");
    gameId = splitedPathName[splitedPathName.length - 1];

    const res = await accountService.authFetch(`${GATEWAY_URL}/api/game/review/${gameId}`);
    const raw = await res.json();
    game_states = raw.grid_states.map(state => uint16Utils.normalizeGameState(state));

    review_analytics.setActions(raw.actions);

    white_player_id = raw.white_player_id;
    black_player_id = raw.black_player_id;

    let whitePlayerInfo = await getUserInformation(white_player_id);
    let blackPlayerInfo = await getUserInformation(black_player_id);

    whitePlayerInfoComponent.setPlayerInfo(whitePlayerInfo)
    blackPlayerInfoComponent.setPlayerInfo(blackPlayerInfo)

}


async function generateEvaluationList(s) {
    const evaluation_list = [];

    // change pas en foreach pck on peut pas await dedans
    for (const state of game_states) {
        const score = await evaluatePosition(state);
        evaluation_list.push(score);
    }

    return evaluation_list;
}


function getNextIndex() {
    let next = state_index + 1;
    if (next >= game_states.length - 1) {
        setTimeout(() => {
            showModal({
                message: "Game Over ?",
                confirmLabel: "Leave",
                cancelLabel: "Cancel",
                onConfirm: () => {
                    window.location.replace(`/`);
                }
            });
        }, 3000)
    } else {
        state_index = next;
    }
    return state_index;
}

function getPreviousIndex() {
    let previous = state_index - 1;
    if (previous >= 0) state_index = previous;
    return state_index;
}

function showModal({ message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
    modal_message.textContent = message;
    modal_confirm.textContent = confirmLabel;
    modal_cancel.textContent = cancelLabel;

    modal.classList.remove('waiting'); // reset état précédent

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

    evalBar.setScore(evalScores[state_index + 1]);

    await boardComponent.updateBoard(data);

    await updatePlayerInfo(whitePlayerInfoComponent, data.colorTurn, data.white_inventory, data.white_time, isStarting)
    await updatePlayerInfo(blackPlayerInfoComponent, data.colorTurn, data.black_inventory, data.black_time, isStarting)


}

async function evaluatePosition(data) {
    try {
        const body = {
            colorTurn: data.colorTurn,
            grid: Array.from(data.grid).map(row => Array.from(new Uint8Array(row))),
            players: [
                {
                    color: 0,
                    kingAlive: data.status !== "BLACK",  // si BLACK a gagné, white est mort
                    inventory: Array.from(new Uint8Array(data.white_inventory))
                },
                {
                    color: 8,
                    kingAlive: data.status !== "WHITE",
                    inventory: Array.from(new Uint8Array(data.black_inventory))
                }
            ]
        };

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/ais/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const { score } = await res.json();
        return score;

    } catch (error) {
        console.error('Error evaluating position:', error);
        return null;
    }
}

async function updatePlayerInfo(playerInfo, colorTurn, inventory, time, isStarting = false) {
    playerInfo.updateInventory(inventory);
    playerInfo.updateTimer(time);
    await playerInfo.setColorTurn(colorTurn);
    if (!isStarting) {
        playerInfo.startTimer();
    }
}

async function startReview() {
    boardComponent.clear();
    await handleUpdate(game_states[state_index], true);
}

async function getUserInformation(userId) {
    try {
        const response = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error while getting user information : ${response.status}`);
        }


        const user = await response.json();

        return user;

    } catch (error) {
        console.error('Failed to fetch user information:', error);
    }
}

// Lancer l'initialisation quand le DOM est prêt
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();