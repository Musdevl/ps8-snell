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

/**
 * Curseur unique de la review, index dans `game_states` :
 *   0 → position initiale, avant le moindre coup
 *   k → position APRÈS le k-ième coup, donc celle produite par `moves[k - 1]`
 *
 * Le composant review-analytics suit la même convention : `highlight_cell(k)`
 * surligne le coup n° k, et `first` (k = 0) ne surligne rien puisqu'aucun coup
 * n'a encore été joué. Toute la page passe par `goToState`, il ne peut donc
 * plus y avoir deux façons de compter.
 */
let state_index = 0;
let has_rendered = false;

let game_states = [];
let game_result = null;

let white_player_id;
let black_player_id;

let isInPlayMode = false;
let play_timeout = null;
let play_token = 0;
let game_over_shown = false;

const PLAY_INTERVAL_MS = 1500;
const GAME_OVER_MODAL_DELAY_MS = 3000;

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
        review_analytics.readyPromise,
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
        await goToState(state_index + 1);
    })

    review_analytics.addEventListener("previous", async () => {
        await goToState(state_index - 1);
    })

    review_analytics.addEventListener("first", async () => {
        await goToState(0);
    })

    review_analytics.addEventListener("last", async () => {
        await goToState(lastStateIndex());
    })

    review_analytics.addEventListener("go-to", async (e) => {
        await goToState(e.detail.index);
    })

    review_analytics.addEventListener("play", () => startPlayback());

    review_analytics.addEventListener("pause", () => stopPlayback());

    document.addEventListener("keydown", async (e) => {
        if (e.key === "ArrowLeft") {
            stopPlayback();
            await goToState(state_index - 1);
        }
        if (e.key === "ArrowRight") {
            stopPlayback();
            await goToState(state_index + 1);
        }
        if (e.key === " ") {
            e.preventDefault(); // sinon la page défile
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

    const moves = extractStatesAndMoves(raw);

    review_analytics.setActions(moves);

    white_player_id = raw.white_player_id;
    black_player_id = raw.black_player_id;

    let whitePlayerInfo = await getUserInformation(white_player_id);
    let blackPlayerInfo = await getUserInformation(black_player_id);

    whitePlayerInfoComponent.setPlayerInfo(whitePlayerInfo)
    blackPlayerInfoComponent.setPlayerInfo(blackPlayerInfo)

}

/**
 * Aligne les états et les coups, et remplit `game_states` / `game_result`.
 *
 * Le serveur empile l'état initial PUIS rejoue toutes les actions sauvegardées
 * — or la liste sauvegardée commence par "INIT", une action qui ne fait rien et
 * qui produit donc un doublon de la position de départ. Elle se termine
 * symétriquement par le résultat ("White won", "DRAW"…), qui n'est pas rejoué
 * et ne produit donc aucun état.
 *
 * On retire ces deux intrus ici, une fois pour toutes. Après quoi l'invariant
 * tient tout seul dans le reste du fichier :
 *
 *      game_states.length === moves.length + 1
 *      moves[k - 1]  a produit  game_states[k]
 *
 * @returns {string[]} les coups réellement joués, dans l'ordre
 */
function extractStatesAndMoves(raw) {
    const states = (raw.grid_states ?? []).map(state => uint16Utils.normalizeGameState(state));
    const actions = [...(raw.actions ?? [])];

    const hasInitAction = actions[0] === "INIT";

    game_states = hasInitAction ? states.slice(1) : states;

    const moves = hasInitAction ? actions.slice(1) : actions;

    // Ce qui dépasse en fin de liste n'a pas d'état : c'est l'issue de partie.
    game_result = null;
    while (moves.length > game_states.length - 1) {
        game_result = moves.pop();
    }

    return moves;
}


async function generateEvaluationList() {
    // Une requête par position, mais toutes en parallèle : en séquentiel la
    // review met plusieurs secondes à s'afficher sur une longue partie.
    return Promise.all(game_states.map(state => evaluatePosition(state)));
}


function lastStateIndex() {
    return Math.max(0, game_states.length - 1);
}

/**
 * Seul point d'entrée pour changer de position : plateau, eval-bar et
 * surlignage du coup sont mis à jour ensemble, ils ne peuvent pas diverger.
 */
async function goToState(index) {
    const target = Math.min(Math.max(index, 0), lastStateIndex());

    if (has_rendered && target === state_index) return;

    // On n'anime que la lecture en avant, coup par coup. En marche arrière ou
    // sur un saut direct, le plateau affiché n'est pas celui d'où part le coup :
    // l'animation jouerait un déplacement depuis une position qui n'a jamais
    // existé.
    const animate = has_rendered && target === state_index + 1;

    state_index = target;
    has_rendered = true;

    review_analytics.highlight_cell(state_index);

    await handleUpdate(state_index, { animate });

    if (state_index === lastStateIndex()) showGameOverModalOnce();
}

function startPlayback() {
    if (isInPlayMode) return;
    if (state_index >= lastStateIndex()) {
        review_analytics.pause();
        return;
    }

    isInPlayMode = true;

    // Un jeton par lecture : une chaîne restée en vol (barre espace pressée
    // deux fois, clic pendant l'attente) se retire d'elle-même.
    const token = ++play_token;

    const playNext = async () => {
        if (!isInPlayMode || token !== play_token) return;

        await goToState(state_index + 1);

        if (!isInPlayMode || token !== play_token) return;

        if (state_index >= lastStateIndex()) {
            stopPlayback();
            return;
        }

        play_timeout = setTimeout(playNext, PLAY_INTERVAL_MS);
    };

    play_timeout = setTimeout(playNext, PLAY_INTERVAL_MS);
}

function stopPlayback() {
    play_token++;

    if (play_timeout) {
        clearTimeout(play_timeout);
        play_timeout = null;
    }

    if (!isInPlayMode) return;

    isInPlayMode = false;
    review_analytics.pause(); // remet l'icône du bouton et l'état du composant
}

function showGameOverModalOnce() {
    if (game_over_shown || lastStateIndex() === 0) return;
    game_over_shown = true;

    // Laissé le temps à la dernière animation (coup + laser) de se terminer.
    setTimeout(() => {
        showModal({
            message: game_result ? `Game over — ${game_result}` : "Game Over ?",
            confirmLabel: "Leave",
            cancelLabel: "Cancel",
            onConfirm: () => {
                window.location.replace(`/`);
            }
        });
    }, GAME_OVER_MODAL_DELAY_MS);
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



async function handleUpdate(index, { animate = true } = {}) {

    const data = game_states[index];
    if (!data) return;

    console.log("[GAME] - Update received: ");

    evalBar.setScore(evalScores?.[index]);

    await boardComponent.updateBoard(data, { animate });

    await updatePlayerInfo(whitePlayerInfoComponent, data.colorTurn, data.white_inventory, data.white_time)
    await updatePlayerInfo(blackPlayerInfoComponent, data.colorTurn, data.black_inventory, data.black_time)


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

/**
 * En review le chrono ne tourne pas : on affiche le temps restant tel qu'il
 * était à cet instant de la partie, et on ne démarre jamais l'intervalle.
 */
async function updatePlayerInfo(playerInfo, colorTurn, inventory, time) {
    playerInfo.updateInventory(inventory);
    playerInfo.updateTimer(time);
    await playerInfo.setColorTurn(colorTurn);
}

async function startReview() {
    boardComponent.clear();
    await goToState(0);
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
