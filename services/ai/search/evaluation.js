import * as engine from "../engine.js";
import { opponentOf } from "./moves.js";
import { DRAW_MOVE_COUNT } from "./position.js";

/**
 * Evaluation statique d'une position, du point de vue d'une couleur.
 *
 * Le principe directeur : au laser chess, la seule chose qui tue est le
 * faisceau. Les intuitions d'echecs (occuper le centre, s'approcher du roi)
 * ne transferent pas — une piece collee au roi adverse ne le menace pas plus
 * qu'une piece a l'autre bout du plateau. Tous les termes sont donc derives
 * de la geometrie du tir, et non des distances.
 *
 * Consequence utile : comme le score est une somme, un coup qui devie le
 * faisceau adverse ET oriente le notre vers son roi cumule automatiquement le
 * gain defensif et le gain offensif. Il n'y a pas de terme special a ecrire
 * pour ces coups a double tranchant, ils sortent gagnants tout seuls.
 */

export const MATE_SCORE = 1_000_000;
export const MATE_THRESHOLD = MATE_SCORE - 1000;

/** Valeur d'un impact sur un roi : enorme, mais pas un mat (le tir n'a pas eu lieu). */
const KING_HIT_VALUE = 50_000;

export const DEFAULT_WEIGHTS = {
    /** > 1 privilegie l'attaque, < 1 la prudence. La retenue vaut 2 - aggression. */
    aggression: 1.0,

    triangle: 100,
    protector: 220,
    reserveTriangle: 85,

    /** Part de la valeur menacee que vaut un faisceau deja pointe dessus. */
    beamPressure: 0.6,
    /** Le camp au trait realise sa menace avant l'autre : elle pese plus lourd. */
    sideToMoveBonus: 1.7,

    kingOpenLine: 30,
    kingGuard: 22,
    cooldown: 16,
};

/**
 * Profil d'evaluation plus ou moins mordant. 1 est neutre ; au-dela l'IA
 * valorise davantage ses menaces et l'exposition du roi adverse, en dessous
 * elle protege d'abord le sien. La retenue est le complement (2 - aggression),
 * si bien qu'une IA agressive accepte reellement plus de risques au lieu de
 * simplement tout surevaluer.
 */
export function weightsWithAggression(aggression) {
    return { ...DEFAULT_WEIGHTS, aggression };
}

export const AGGRESSIVE_WEIGHTS = weightsWithAggression(1.3);

// ─── ETAT DE TRAVAIL REUTILISE ───────────────────────────────────────────────
// L'evaluation est appelee des centaines de milliers de fois par recherche :
// tout ce qui est alloue ici le serait a chaque appel.

const beamTrace = engine.createBeamTrace();
const scan = [newSide(), newSide()];

function newSide() {
    return { material: 0, cooldown: 0, kingSquare: -1 };
}

const sideIndex = color => color >> 3; // WHITE (0) -> 0, BLACK (8) -> 1

export function evaluate(game, color, weights = DEFAULT_WEIGHTS) {
    const opponent = opponentOf(color);
    const myKingAlive = game.getPlayerByColor(color).kingAlive;
    const opponentKingAlive = game.getPlayerByColor(opponent).kingAlive;

    if (!myKingAlive && !opponentKingAlive) return 0;
    if (!myKingAlive) return -MATE_SCORE;
    if (!opponentKingAlive) return MATE_SCORE;
    if (game.count >= DRAW_MOVE_COUNT) return 0;

    const board = game.board;
    scanBoard(board, weights);

    const mine = scan[sideIndex(color)];
    const theirs = scan[sideIndex(opponent)];
    const aggression = weights.aggression;
    const caution = 2 - aggression;

    let score = 0;

    // ── Materiel : plateau + reserve ────────────────────────────────────────
    score += mine.material - theirs.material;
    score += (countReserve(game, color) - countReserve(game, opponent)) * weights.reserveTriangle;

    // ── Pression des faisceaux ──────────────────────────────────────────────
    // Ce que chaque tir detruirait s'il partait maintenant. Les degats qu'un
    // camp s'inflige a lui-meme comptent en negatif, ce qui suffit a rendre
    // une deviation du faisceau adverse vers son propre camp tres rentable.
    const iAmToMove = game.colorTurn === color;
    const myUrgency = iAmToMove ? weights.sideToMoveBonus : 1;
    const theirUrgency = iAmToMove ? 1 : weights.sideToMoveBonus;

    const myBeam = beamGain(board, color, weights) * weights.beamPressure * myUrgency;
    const theirBeam = beamGain(board, opponent, weights) * weights.beamPressure * theirUrgency;
    score += myBeam * aggression - theirBeam * caution;

    // ── Exposition des rois ─────────────────────────────────────────────────
    // Une ligne orthogonale degagee jusqu'au bord est une voie toute tracee
    // pour un faisceau redirige par un miroir : c'est ca, la vulnerabilite
    // d'un roi ici, pas le nombre d'ennemis a cote de lui.
    score += exposure(board, theirs.kingSquare, opponent, weights) * aggression;
    score -= exposure(board, mine.kingSquare, color, weights) * caution;

    // ── Pieces inertes ──────────────────────────────────────────────────────
    score -= (mine.cooldown - theirs.cooldown) * weights.cooldown;

    return score;
}

function scanBoard(board, weights) {
    for (const side of scan) { side.material = 0; side.cooldown = 0; side.kingSquare = -1; }

    const grid = board.grid;
    for (let cell = 0; cell < 100; cell++) {
        const value = grid[cell];
        if (value === 0) continue;

        const side = scan[sideIndex(value & engine.MASK.COLOR)];
        side.material += pieceValue(value, weights);
        side.cooldown += (value & engine.MASK.COOLDOWN) >> 6;
        if ((value & engine.MASK.PIECE) === engine.PIECE.KING) side.kingSquare = cell;
    }
}

/**
 * Seuls les triangles et les protecteurs peuvent disparaitre : le faisceau
 * rebondit toujours sur un miroir plein et s'arrete sur un tireur, donc leur
 * compter une valeur reviendrait a ajouter une constante des deux cotes.
 * Le roi est traite a part (fin de partie, ou KING_HIT_VALUE dans un tir).
 */
function pieceValue(value, weights) {
    switch (value & engine.MASK.PIECE) {
        case engine.PIECE.TRIANGLE: return weights.triangle;
        case engine.PIECE.PROTECTOR: return weights.protector;
        default: return 0;
    }
}

function countReserve(game, color) {
    const inventory = game.getPlayerByColor(color).inventory;
    let count = 0;
    for (let i = 0; i < inventory.length; i++) if (inventory[i] !== 0) count++;
    return count;
}

/**
 * Bilan du tir de `shooterColor` tel que le faisceau est oriente maintenant :
 * positif s'il fait plus de degats a l'adversaire qu'a lui-meme.
 * Le faisceau traverse ce qu'il detruit, donc un tir peut faire plusieurs
 * victimes et toucher les deux camps a la fois.
 */
export function beamGain(board, shooterColor, weights = DEFAULT_WEIGHTS) {
    engine.traceBeam(board, shooterColor, beamTrace);

    let gain = 0;
    for (let i = 0; i < beamTrace.hitCount; i++) {
        const value = beamTrace.hitValues[i];
        const worth = (value & engine.MASK.PIECE) === engine.PIECE.KING ? KING_HIT_VALUE : pieceValue(value, weights);
        gain += (value & engine.MASK.COLOR) === shooterColor ? -worth : worth;
    }
    return gain;
}

const RAY_ROW = [-1, 0, 1, 0];
const RAY_COL = [0, 1, 0, -1];

/** Nombre de lignes orthogonales libres autour du roi, moins ses gardes. */
function exposure(board, kingSquare, kingColor, weights) {
    if (kingSquare < 0) return 0;

    const grid = board.grid;
    const kingRow = (kingSquare / 10) | 0, kingCol = kingSquare % 10;
    let openLines = 0, guards = 0;

    for (let direction = 0; direction < 4; direction++) {
        let row = kingRow + RAY_ROW[direction], col = kingCol + RAY_COL[direction];

        if (row >= 0 && row < 10 && col >= 0 && col < 10) {
            const neighbour = grid[row * 10 + col];
            if (neighbour !== 0 && (neighbour & engine.MASK.COLOR) === kingColor) guards++;
        }
        while (row >= 0 && row < 10 && col >= 0 && col < 10 && grid[row * 10 + col] === 0) {
            row += RAY_ROW[direction];
            col += RAY_COL[direction];
        }
        if (row < 0 || row > 9 || col < 0 || col > 9) openLines++;
    }

    return openLines * weights.kingOpenLine - guards * weights.kingGuard;
}
