import * as engine from "../engine.js";
import { MOVE_TYPE, moveType, moveFrom, moveTo, movePayload } from "./moves.js";
import { beamGain, DEFAULT_WEIGHTS } from "./evaluation.js";

/**
 * Detection des coups qui font effectivement feu.
 *
 * Observation qui fonde tout ce module : le faisceau est deterministe, donc un
 * coup ne peut modifier le tir d'un camp QUE s'il touche une case deja
 * traversee par ce tir, ou s'il deplace / fait pivoter le tireur lui-meme.
 * Tout le reste laisse la trajectoire identique. On peut donc isoler en O(1)
 * par coup le petit sous-ensemble reellement tactique — typiquement 20 a 40
 * coups sur les ~110 jouables — au lieu de simuler la partie entiere pour
 * chacun d'eux comme le faisait l'ancien tri.
 */

const onBeam = new Int32Array(100);
let beamStamp = 0;
let beamShooterSquare = -1;

/** Prepare le masque du faisceau de `color`. A rappeler des que le plateau change. */
export function markBeam(board, color, trace) {
    engine.traceBeam(board, color, trace);
    beamStamp++;
    for (let i = 0; i < trace.pathLength; i++) onBeam[trace.path[i]] = beamStamp;
    beamShooterSquare = engine.findShooterSquare(board, color);
}

/** Ce coup peut-il changer la trajectoire du tir prepare par markBeam ? */
export function affectsBeam(move) {
    const from = moveFrom(move);
    if (from === beamShooterSquare) return true;
    if (onBeam[from] === beamStamp) return true;

    const type = moveType(move);
    if (type === MOVE_TYPE.MOVE || type === MOVE_TYPE.SWAP) {
        const to = moveTo(move);
        if (to === beamShooterSquare) return true;
        if (onBeam[to] === beamStamp) return true;
    }
    return false;
}

/**
 * Bilan du tir qui suivrait ce coup, sans jouer le coup pour de vrai : on
 * applique la seule mutation du plateau, on retrace le faisceau, on remet en
 * place. Les cooldowns et les inventaires n'influencent pas la trajectoire,
 * il est donc inutile de les simuler ici.
 */
export function probeMoveGain(board, move, color, weights = DEFAULT_WEIGHTS) {
    const grid = board.grid;
    const from = moveFrom(move);
    const type = moveType(move);

    const savedFrom = grid[from];
    let to = -1, savedTo = 0;

    switch (type) {
        case MOVE_TYPE.MOVE:
            to = moveTo(move); savedTo = grid[to];
            grid[to] = savedFrom; grid[from] = 0;
            break;
        case MOVE_TYPE.ROTATE:
            grid[from] = movePayload(move) === 0 ? engine.rotateLeft(savedFrom) : engine.rotateRight(savedFrom);
            break;
        case MOVE_TYPE.SWAP:
            to = moveTo(move); savedTo = grid[to];
            // Un echange avec le tireur empeche le tir (engine.swap : allowed_to_shoot).
            if ((savedTo & engine.MASK.PIECE) === engine.PIECE.SHOOTER) return 0;
            grid[from] = savedTo; grid[to] = savedFrom;
            break;
        case MOVE_TYPE.PLACE:
            grid[from] = engine.createPiece(engine.PIECE.TRIANGLE, color, engine.indexToDir(movePayload(move)), 0);
            break;
    }

    const gain = beamGain(board, color, weights);

    grid[from] = savedFrom;
    if (to >= 0) grid[to] = savedTo;
    return gain;
}
