import * as engine from "../engine.js";
import { SearchPosition, DRAW_MOVE_COUNT } from "./position.js";
import { generateMoves, opponentOf, NO_MOVE, MAX_MOVES } from "./moves.js";
import { evaluate, MATE_SCORE, MATE_THRESHOLD, DEFAULT_WEIGHTS } from "./evaluation.js";
import { markBeam, affectsBeam, probeMoveGain } from "./tactics.js";

/**
 * Recherche negamax : approfondissement iteratif, elagage alpha-beta en
 * fenetre nulle (PVS), reductions sur les coups tardifs, recherche de
 * quiescence sur les tirs, table de transposition, killer moves et heuristique
 * d'historique.
 *
 * Le negamax evalue toujours du point de vue du camp au trait, ce qui evite de
 * trainer un booleen "isMaximizing" et supprime toute possibilite de
 * desynchronisation entre le camp evalue et le camp qui joue.
 */

const MAX_PLY = 64;
const QUIESCENCE_MAX_DEPTH = 4;
const DEADLINE_CHECK_MASK = 2047; // on lit l'horloge un noeud sur 2048

// Barème du tri des coups. Les echelles sont disjointes pour qu'une categorie
// ne puisse jamais en depasser une autre par accident.
const TT_MOVE_BONUS = 4_000_000;
const TACTICAL_BONUS = 2_000_000;
const KILLER_1_BONUS = 1_100_000;
const KILLER_2_BONUS = 1_000_000;
const MAX_HISTORY = 900_000;
const LOSING_MOVE_PENALTY = -2_000_000; // notre propre tir se retournerait contre nous

const LMR_FIRST_MOVE = 4;   // les 4 premiers coups sont explores a pleine profondeur
const LMR_DEEP_MOVE = 12;

/**
 * Elagage des coups calmes tardifs. Le branching est ici domine par les poses
 * de triangle, dont l'immense majorite ne fait rien : passe un certain rang
 * dans une liste deja triee, continuer a les explorer a faible profondeur ne
 * rapporte statistiquement plus rien. Les deux gardes qui rendent ca sur :
 * on ne coupe jamais un coup qui fait feu (ils sont tries avant), et jamais
 * quand on est en train de se faire mater et qu'on cherche une parade.
 */
const LATE_MOVE_LIMIT = [0, 8, 14, 22]; // indexe par profondeur restante
const FUTILITY_MAX_DEPTH = 2;
const FUTILITY_MARGIN = 180;

export class SearchTimeout extends Error {}

// ─── TABLE DE TRANSPOSITION ──────────────────────────────────────────────────
// Tableaux typés a taille fixe plutot qu'une Map d'objets : la Map allouait un
// objet par noeud et faisait travailler le ramasse-miettes en pleine recherche.

const TT_SIZE = 1 << 19;
const BOUND = { EXACT: 0, LOWER: 1, UPPER: 2 };

const ttKey = new Float64Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttMove = new Int32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE);
const ttBound = new Int8Array(TT_SIZE);
const ttAge = new Int32Array(TT_SIZE);
let currentAge = 0;

// ─── ETAT DE RECHERCHE (une seule recherche a la fois, service mono-thread) ──

const moveBuffers = [];
const scoreBuffers = [];
const beamTraces = [];
for (let ply = 0; ply < MAX_PLY; ply++) {
    moveBuffers.push(new Int32Array(MAX_MOVES));
    scoreBuffers.push(new Int32Array(MAX_MOVES));
    beamTraces.push(engine.createBeamTrace());
}

const killers = new Int32Array(MAX_PLY * 2);
const history = new Int32Array(1 << 18); // indexe directement par le coup encode

let position = null;
let weights = DEFAULT_WEIGHTS;
let deadline = 0;
let nodeCount = 0;

/**
 * Renvoie tous les coups de la racine classes du meilleur au moins bon.
 * Le classement complet (et pas seulement le meilleur coup) sert au tirage
 * d'erreur des IA faibles, qui choisissent parfois un coup sous-optimal.
 */
export function search(game, { maxDepth = 6, timeBudgetMs = 2000, weights: customWeights = DEFAULT_WEIGHTS } = {}) {
    const start = performance.now();

    position = new SearchPosition(game.clone());
    weights = customWeights;
    deadline = start + timeBudgetMs;
    nodeCount = 0;
    currentAge++;
    killers.fill(0);
    decayHistory();

    const rootColor = position.colorTurn;
    const rootMoves = moveBuffers[0];
    const rootCount = generateMoves(position.game, rootColor, rootMoves, beamTraces[0]);
    if (rootCount === 0) throw new Error("Aucun coup jouable");

    let ranked = initialRanking(rootMoves, rootCount);
    let depthReached = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
        try {
            ranked = searchRoot(depth, ranked);
            depthReached = depth;
        } catch (error) {
            if (error instanceof SearchTimeout) break;
            throw error;
        }
        // Un mat force est trouve : chercher plus loin ne changera rien.
        if (Math.abs(ranked[0].score) > MATE_THRESHOLD) break;
    }

    return { ranked, depthReached, nodes: nodeCount, elapsedMs: performance.now() - start };
}

function initialRanking(moves, count) {
    const ranking = new Array(count);
    for (let i = 0; i < count; i++) ranking[i] = { move: moves[i], score: 0 };
    return ranking;
}

/**
 * La racine reprend l'ordre de l'iteration precedente : le meilleur coup
 * d'hier est presque toujours le meilleur coup d'aujourd'hui, et l'explorer en
 * premier fait tomber alpha-beta beaucoup plus vite.
 */
function searchRoot(depth, previousRanking) {
    const ranking = [];
    let alpha = -MATE_SCORE;

    for (let i = 0; i < previousRanking.length; i++) {
        const move = previousRanking[i].move;
        position.make(move);
        let score;
        try {
            score = i === 0
                ? -negamax(depth - 1, -MATE_SCORE, -alpha, 1)
                : researchIfPromising(depth, alpha, 1);
        } finally {
            position.unmake();
        }
        ranking.push({ move, score });
        if (score > alpha) alpha = score;
    }

    ranking.sort((a, b) => b.score - a.score);
    return ranking;
}

function researchIfPromising(depth, alpha, ply) {
    const score = -negamax(depth - 1, -alpha - 1, -alpha, ply);
    return score > alpha ? -negamax(depth - 1, -MATE_SCORE, -alpha, ply) : score;
}

// ─── NOEUD ───────────────────────────────────────────────────────────────────

function negamax(depth, alpha, beta, ply) {
    if ((++nodeCount & DEADLINE_CHECK_MASK) === 0 && performance.now() > deadline) throw new SearchTimeout();

    const terminal = terminalScore(ply);
    if (terminal !== null) return terminal;
    if (ply >= MAX_PLY - QUIESCENCE_MAX_DEPTH - 2) return evaluate(position.game, position.colorTurn, weights);
    if (depth <= 0) return quiescence(alpha, beta, ply, QUIESCENCE_MAX_DEPTH);

    const key = position.key();
    const slot = key % TT_SIZE; // la cle depasse 2^31 : un ET binaire la tronquerait
    let hashMove = NO_MOVE;

    if (ttKey[slot] === key) {
        hashMove = ttMove[slot];
        if (ttDepth[slot] >= depth) {
            const score = scoreFromTable(ttScore[slot], ply);
            const bound = ttBound[slot];
            if (bound === BOUND.EXACT) return score;
            if (bound === BOUND.LOWER && score >= beta) return score;
            if (bound === BOUND.UPPER && score <= alpha) return score;
        }
    }

    const color = position.colorTurn;
    const moves = moveBuffers[ply];
    const scores = scoreBuffers[ply];
    const count = generateMoves(position.game, color, moves, beamTraces[ply]);
    if (count === 0) return evaluate(position.game, color, weights);

    scoreMoves(moves, scores, count, color, hashMove, ply);

    const originalAlpha = alpha;
    const staticEval = depth <= FUTILITY_MAX_DEPTH ? evaluate(position.game, color, weights) : 0;
    let bestScore = -MATE_SCORE - 1;
    let bestMove = NO_MOVE;

    for (let i = 0; i < count; i++) {
        selectNextMove(moves, scores, count, i);
        const move = moves[i];
        const quiet = scores[i] < TACTICAL_BONUS;

        if (quiet && bestMove !== NO_MOVE && bestScore > -MATE_THRESHOLD) {
            if (depth < LATE_MOVE_LIMIT.length && i >= LATE_MOVE_LIMIT[depth]) continue;
            if (depth <= FUTILITY_MAX_DEPTH && staticEval + FUTILITY_MARGIN * depth <= alpha) continue;
        }

        position.make(move);
        let score;
        try {
            score = searchChild(depth, alpha, beta, ply, i, quiet);
        } finally {
            position.unmake();
        }

        if (score > bestScore) { bestScore = score; bestMove = move; }
        if (score > alpha) alpha = score;
        if (alpha >= beta) {
            if (quiet) rememberQuietMove(move, ply, depth);
            break;
        }
    }

    const bound = bestScore >= beta ? BOUND.LOWER : bestScore > originalAlpha ? BOUND.EXACT : BOUND.UPPER;
    storeInTable(slot, key, bestScore, bestMove, depth, bound, ply);
    return bestScore;
}

/**
 * PVS : seul le premier coup est explore en fenetre pleine. Les suivants sont
 * testes en fenetre nulle, et re-explores seulement s'ils menacent de faire
 * mieux. Les coups calmes explores tard sont en plus reduits (LMR) : s'ils
 * remontent malgre la reduction, on les reprend a pleine profondeur.
 */
function searchChild(depth, alpha, beta, ply, moveIndex, quiet) {
    if (moveIndex === 0) return -negamax(depth - 1, -beta, -alpha, ply + 1);

    let reduction = 0;
    if (quiet && depth >= 3 && moveIndex >= LMR_FIRST_MOVE) reduction = moveIndex >= LMR_DEEP_MOVE ? 2 : 1;

    let score = -negamax(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1);
    if (score > alpha && reduction > 0) score = -negamax(depth - 1, -alpha - 1, -alpha, ply + 1);
    if (score > alpha && score < beta) score = -negamax(depth - 1, -beta, -alpha, ply + 1);
    return score;
}

/**
 * Recherche de quiescence : on ne s'arrete jamais sur une position ou un tir
 * decisif est en attente. Sans elle, l'approfondissement iteratif oscille —
 * une profondeur impaire finit juste apres notre propre tir et surestime la
 * position, une profondeur paire juste apres celui de l'adversaire et la
 * sous-estime. C'est aussi ce qui donne la vision du mat en un coup sans
 * depenser un niveau de profondeur complet.
 */
function quiescence(alpha, beta, ply, remaining) {
    if ((++nodeCount & DEADLINE_CHECK_MASK) === 0 && performance.now() > deadline) throw new SearchTimeout();

    const terminal = terminalScore(ply);
    if (terminal !== null) return terminal;

    const color = position.colorTurn;
    const standPat = evaluate(position.game, color, weights);
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    if (remaining <= 0 || ply >= MAX_PLY - 2) return standPat;

    const moves = moveBuffers[ply];
    const scores = scoreBuffers[ply];
    const generated = generateMoves(position.game, color, moves, beamTraces[ply]);
    const count = keepFiringMoves(moves, scores, generated, color, ply);

    let best = standPat;
    for (let i = 0; i < count; i++) {
        selectNextMove(moves, scores, count, i);
        position.make(moves[i]);
        let score;
        try {
            score = -quiescence(-beta, -alpha, ply + 1, remaining - 1);
        } finally {
            position.unmake();
        }
        if (score > best) best = score;
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
    }
    return best;
}

/** Compacte la liste sur les seuls coups dont le tir detruit quelque chose. */
function keepFiringMoves(moves, scores, generated, color, ply) {
    markBeam(position.board, color, beamTraces[ply]);

    let count = 0;
    for (let i = 0; i < generated; i++) {
        const move = moves[i];
        if (!affectsBeam(move)) continue;
        const gain = probeMoveGain(position.board, move, color, weights);
        if (gain <= 0) continue;
        moves[count] = move;
        scores[count] = gain;
        count++;
    }
    return count;
}

function terminalScore(ply) {
    const color = position.colorTurn;
    const opponent = opponentOf(color);
    const mine = position.kingAlive(color);
    const theirs = position.kingAlive(opponent);

    if (!mine && !theirs) return 0;
    if (!mine) return -MATE_SCORE + ply;
    if (!theirs) return MATE_SCORE - ply;
    if (position.game.count >= DRAW_MOVE_COUNT) return 0;
    return null;
}

// ─── TRI DES COUPS ───────────────────────────────────────────────────────────

/**
 * L'ancien tri simulait la partie et l'evaluait pour CHAQUE coup de CHAQUE
 * noeud, soit une recherche a un demi-coup refaite partout — plus chere que la
 * recherche elle-meme. Ici seuls les coups qui peuvent changer la trajectoire
 * du tir sont reellement sondes ; les autres sont classes par killer moves et
 * historique, qui ne coutent qu'une lecture de tableau.
 */
function scoreMoves(moves, scores, count, color, hashMove, ply) {
    markBeam(position.board, color, beamTraces[ply]);
    const killer1 = killers[ply * 2];
    const killer2 = killers[ply * 2 + 1];

    for (let i = 0; i < count; i++) {
        const move = moves[i];

        if (move === hashMove) { scores[i] = TT_MOVE_BONUS; continue; }

        if (affectsBeam(move)) {
            const gain = probeMoveGain(position.board, move, color, weights);
            if (gain > 0) { scores[i] = TACTICAL_BONUS + gain; continue; }
            // Un coup qui offre nos propres pieces a notre propre laser part en
            // toute fin de liste : c'est presque toujours une bevue.
            if (gain < 0) { scores[i] = LOSING_MOVE_PENALTY + gain; continue; }
        }

        if (move === killer1) { scores[i] = KILLER_1_BONUS; continue; }
        if (move === killer2) { scores[i] = KILLER_2_BONUS; continue; }
        scores[i] = history[move & 0x3ffff];
    }
}

/**
 * Tri par selection incrementale : on ne remonte que le meilleur coup restant.
 * Comme alpha-beta coupe le plus souvent apres deux ou trois coups, trier la
 * liste entiere serait du travail perdu.
 */
function selectNextMove(moves, scores, count, from) {
    let best = from;
    for (let i = from + 1; i < count; i++) if (scores[i] > scores[best]) best = i;
    if (best === from) return;

    const move = moves[from]; moves[from] = moves[best]; moves[best] = move;
    const score = scores[from]; scores[from] = scores[best]; scores[best] = score;
}

function rememberQuietMove(move, ply, depth) {
    const slot = ply * 2;
    if (killers[slot] !== move) { killers[slot + 1] = killers[slot]; killers[slot] = move; }

    const index = move & 0x3ffff;
    history[index] = Math.min(history[index] + depth * depth, MAX_HISTORY);
}

/**
 * L'historique est conserve d'un coup a l'autre (les bons coups calmes le
 * restent souvent), mais divise avant chaque recherche pour que la partie
 * courante pese plus lourd que les positions deja quittees.
 */
function decayHistory() {
    for (let i = 0; i < history.length; i++) history[i] >>= 2;
}

// ─── TABLE DE TRANSPOSITION ──────────────────────────────────────────────────

/**
 * Un score de mat vaut "mat dans N coups a partir d'ici" : il depend donc de
 * la profondeur du noeud. On le stocke rendu absolu et on le relit relatif au
 * noeud courant, sinon une entree reutilisee ailleurs dans l'arbre annoncerait
 * une distance de mat fausse.
 */
function scoreToTable(score, ply) {
    if (score > MATE_THRESHOLD) return score + ply;
    if (score < -MATE_THRESHOLD) return score - ply;
    return score;
}

function scoreFromTable(score, ply) {
    if (score > MATE_THRESHOLD) return score - ply;
    if (score < -MATE_THRESHOLD) return score + ply;
    return score;
}

/**
 * Remplacement en profondeur : une entree de la recherche en cours n'est
 * ecrasee que par une analyse au moins aussi profonde. Les entrees des
 * recherches precedentes sont toujours remplacables.
 */
function storeInTable(slot, key, score, move, depth, bound, ply) {
    if (ttAge[slot] === currentAge && ttKey[slot] === key && ttDepth[slot] > depth) return;

    ttKey[slot] = key;
    ttScore[slot] = scoreToTable(score, ply);
    ttMove[slot] = move;
    ttDepth[slot] = depth;
    ttBound[slot] = bound;
    ttAge[slot] = currentAge;
}
