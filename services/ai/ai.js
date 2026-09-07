import * as engine from "./engine.js";
import { search } from "./search/search.js";
import { moveToString, generateMoves, MAX_MOVES } from "./search/moves.js";
import { evaluate as evaluatePosition, MATE_SCORE, MATE_THRESHOLD, DEFAULT_WEIGHTS, AGGRESSIVE_WEIGHTS, weightsWithAggression } from "./search/evaluation.js";

/**
 * Facade du moteur d'IA : c'est la seule surface que les modeles (model/*.js)
 * et l'API HTTP utilisent. Toute la mecanique vit dans search/.
 */

export { MATE_SCORE, MATE_THRESHOLD, DEFAULT_WEIGHTS, AGGRESSIVE_WEIGHTS, weightsWithAggression };

const randomMoveBuffer = new Int32Array(MAX_MOVES);
const randomBeamTrace = engine.createBeamTrace();

export function getRandomAction(game) {
    const actions = engine.getAllActions(game);
    if (!actions.length) throw new Error("Aucun coup jouable");
    return actions[Math.floor(Math.random() * actions.length)];
}

/** Score de la position du point de vue de `color`, en centiemes de triangle. */
export function evaluate(game, color, weights = DEFAULT_WEIGHTS) {
    return evaluatePosition(game, color, weights);
}

/**
 * Meilleur coup selon la recherche.
 *
 * `blunderRate` et `blunderPool` modelisent la faiblesse des IA de bas Elo :
 * plutot que de simplement brider la profondeur — ce qui donne une IA
 * tactiquement parfaite a un demi-coup, donc bizarrement forte par moments —
 * on lui fait choisir de temps en temps un coup moins bon parmi les suivants
 * du classement. Le resultat ressemble beaucoup plus a un joueur debutant.
 */
export function findBestAction(game, options = {}) {
    const { blunderRate = 0, blunderPool = 1, random = Math.random } = options;
    const { ranked, depthReached, nodes, elapsedMs } = search(game, options);

    const chosen = pickMove(ranked, blunderRate, blunderPool, random);
    return {
        action: moveToString(chosen.move),
        score: chosen.score,
        bestScore: ranked[0].score,
        depthReached,
        nodes,
        elapsedMs,
    };
}

function pickMove(ranked, blunderRate, blunderPool, random) {
    if (blunderRate <= 0 || ranked.length < 2 || random() >= blunderRate) return ranked[0];

    // On ne pioche jamais dans un coup qui perd le roi sur-le-champ : meme un
    // debutant ne se suicide pas volontairement, il rate juste les bons coups.
    const pool = ranked.slice(1, 1 + blunderPool).filter(entry => entry.score > -MATE_THRESHOLD);
    if (!pool.length) return ranked[0];
    return pool[Math.floor(random() * pool.length)];
}

/** Nombre de coups explores par la recherche a la racine (diagnostic). */
export function countSearchActions(game) {
    return generateMoves(game, game.colorTurn, randomMoveBuffer, randomBeamTrace);
}
