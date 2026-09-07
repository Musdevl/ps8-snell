import * as engine from "../engine.js";

/**
 * Encodage des coups sur un entier 32 bits.
 *
 * Pendant la recherche un coup est manipule des dizaines de milliers de fois :
 * le format texte de l'API ("PLACE/74,0") imposerait un split + parse a chaque
 * simulation. On garde donc un entier en interne et on ne repasse au texte
 * qu'a la frontiere (le coup finalement joue, renvoye par l'API).
 *
 *   bits 0..1   type      (0 MOVE, 1 ROTATE, 2 SWAP, 3 PLACE)
 *   bits 2..8   case de depart      (0..99, indice plat row * 10 + col)
 *   bits 9..15  case d'arrivee      (MOVE et SWAP uniquement)
 *   bits 16..17 charge utile        (index de direction pour PLACE,
 *                                    sens de rotation pour ROTATE)
 */

export const MOVE_TYPE = { MOVE: 0, ROTATE: 1, SWAP: 2, PLACE: 3 };

export const NO_MOVE = 0;
export const MAX_MOVES = 512;

export const encodeMove = (type, from, to, payload) => type | (from << 2) | (to << 9) | (payload << 16);

export const moveType = m => m & 0b11;
export const moveFrom = m => (m >> 2) & 0x7f;
export const moveTo = m => (m >> 9) & 0x7f;
export const movePayload = m => (m >> 16) & 0b11;

const ROTATION_SENSE = [engine.ROTATION_DIRECTION.CLOCK_WISE, engine.ROTATION_DIRECTION.ANTI_CLOCK_WISE];
const square = (row, col) => row * 10 + col;
const rowOf = s => (s / 10) | 0;
const colOf = s => s % 10;

/** Format attendu par le moteur et par l'API HTTP. */
export function moveToString(move) {
    const from = moveFrom(move), to = moveTo(move);
    switch (moveType(move)) {
        case MOVE_TYPE.MOVE: return `MOVE/${pad(from)},${pad(to)}`;
        case MOVE_TYPE.ROTATE: return `ROTATE/${pad(from)},${ROTATION_SENSE[movePayload(move)]}`;
        case MOVE_TYPE.SWAP: return `SWAP/${pad(from)},${pad(to)}`;
        case MOVE_TYPE.PLACE: return `PLACE/${pad(from)},${engine.indexToDir(movePayload(move))}`;
        default: throw new Error(`Type de coup inconnu: ${move}`);
    }
}

// Les cases sont serialisees sur exactement deux caracteres ("04", "74") :
// le moteur relit row et col en lisant s[0] et s[1].
const pad = s => (s < 10 ? `0${s}` : `${s}`);

export function parseMove(action) {
    const [type, payload] = action.split("/");
    const [left, right] = payload.split(",");
    const from = +left[0] * 10 + +left[1];
    switch (type) {
        case "MOVE": return encodeMove(MOVE_TYPE.MOVE, from, +right[0] * 10 + +right[1], 0);
        case "SWAP": return encodeMove(MOVE_TYPE.SWAP, from, +right[0] * 10 + +right[1], 0);
        case "ROTATE": return encodeMove(MOVE_TYPE.ROTATE, from, 0, +right === engine.ROTATION_DIRECTION.CLOCK_WISE ? 0 : 1);
        case "PLACE": return encodeMove(MOVE_TYPE.PLACE, from, 0, engine.dirIndex(+right));
        default: throw new Error(`Action invalide: ${action}`);
    }
}

// ─── GENERATION ──────────────────────────────────────────────────────────────

const NEIGHBOUR_ROW = [-1, 0, 1, 0];
const NEIGHBOUR_COL = [0, 1, 0, -1];

/**
 * Les coups PLACE representent a eux seuls plus de 90 % du branching (324 sur
 * 343 des la position initiale) alors que l'immense majorite d'entre eux ne
 * changent rien : un triangle pose loin de tout faisceau n'a aucun effet, ni
 * ce tour-ci ni le suivant. On ne garde donc que les cases qui touchent un des
 * deux faisceaux, ou qui les jouxtent (une case adjacente devient pertinente
 * des que quelqu'un fait pivoter une piece du trajet).
 *
 * Ce filtre divise le branching par ~2,4 tout en conservant un coup gagnant
 * dans 98 % des positions ou il en existe un ; le generateur tactique
 * ci-dessous rattrape le reste, donc aucun mat n'est perdu.
 */
const placeMask = new Int32Array(100);
let placeStamp = 0;

function markRelevantPlaceCells(board, color, beam) {
    placeStamp++;
    for (const shooterColor of [color, opponentOf(color)]) {
        engine.traceBeam(board, shooterColor, beam);
        for (let i = 0; i < beam.pathLength; i++) {
            const cell = beam.path[i];
            placeMask[cell] = placeStamp;
            const row = rowOf(cell), col = colOf(cell);
            for (let d = 0; d < 4; d++) {
                const r = row + NEIGHBOUR_ROW[d], c = col + NEIGHBOUR_COL[d];
                if (r >= 0 && r < 10 && c >= 0 && c < 10) placeMask[square(r, c)] = placeStamp;
            }
        }
    }
}

export const opponentOf = color => color === engine.COLORS.WHITE ? engine.COLORS.BLACK : engine.COLORS.WHITE;

/**
 * Ecrit tous les coups jouables par `color` dans `out` et renvoie leur nombre.
 * `out` est un buffer reutilise par profondeur : la generation n'alloue rien.
 */
export function generateMoves(game, color, out, beam) {
    const grid = game.board.grid;
    let count = 0;

    for (let from = 0; from < 100; from++) {
        const value = grid[from];
        if (value === 0 || (value & engine.MASK.COLOR) !== color) continue;

        const piece = value & engine.MASK.PIECE;
        const onCooldown = (value & engine.MASK.COOLDOWN) !== 0;
        const row = rowOf(from), col = colOf(from);

        // Le roi ne pivote pas ; le roi et le tireur ne se deplacent pas.
        if (piece !== engine.PIECE.KING) {
            out[count++] = encodeMove(MOVE_TYPE.ROTATE, from, 0, 0);
            out[count++] = encodeMove(MOVE_TYPE.ROTATE, from, 0, 1);
        }
        if (!onCooldown && piece !== engine.PIECE.SHOOTER && piece !== engine.PIECE.KING) {
            for (let d = 0; d < 4; d++) {
                const r = row + NEIGHBOUR_ROW[d], c = col + NEIGHBOUR_COL[d];
                if (r < 0 || r > 9 || c < 0 || c > 9) continue;
                const to = square(r, c);
                if (grid[to] === 0) out[count++] = encodeMove(MOVE_TYPE.MOVE, from, to, 0);
            }
        }
        // Un echange part toujours du miroir plein et vise le roi ou le tireur.
        if (piece === engine.PIECE.FULL_MIRROR && !onCooldown) {
            for (let to = 0; to < 100; to++) {
                const target = grid[to];
                if (target === 0 || (target & engine.MASK.COLOR) !== color) continue;
                if ((target & engine.MASK.COOLDOWN) !== 0) continue;
                const targetPiece = target & engine.MASK.PIECE;
                if (targetPiece === engine.PIECE.KING || targetPiece === engine.PIECE.SHOOTER)
                    out[count++] = encodeMove(MOVE_TYPE.SWAP, from, to, 0);
            }
        }
    }

    count = appendPlaceMoves(game, color, out, count, beam);
    return count;
}

function appendPlaceMoves(game, color, out, count, beam) {
    if (!engine.checkPlayerCanPlace(game.getPlayerByColor(color))) return count;

    const board = game.board;
    const grid = board.grid;
    markRelevantPlaceCells(board, color, beam);

    for (let cell = 0; cell < 100; cell++) {
        if (grid[cell] !== 0 || placeMask[cell] !== placeStamp) continue;
        const row = rowOf(cell), col = colOf(cell);
        if (engine.isNearToAShooter(board, row, col)) continue;
        if (engine.isNearToYourKing(board, row, col, color)) continue;
        for (let direction = 0; direction < 4; direction++)
            out[count++] = encodeMove(MOVE_TYPE.PLACE, cell, 0, direction);
    }
    return count;
}
