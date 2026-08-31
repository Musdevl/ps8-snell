import { AbstractAi } from "./AbstractAi.js";
import { findBestAction } from "../ai.js";

/**
 * IA générique basée sur minimax + alpha-bêta (voir ai.js).
 * maxDepth borne la profondeur de recherche, timeBudgetMs est le garde-fou
 * temporel : si la profondeur n'est pas atteignable à temps, le meilleur
 * coup de la dernière profondeur terminée est utilisé.
 * Plus une IA est forte (Elo élevé), plus maxDepth et timeBudgetMs sont grands.
 */
export class MinimaxAi extends AbstractAi {
    constructor(id, name, elo, path, maxDepth, timeBudgetMs) {
        super(id, name, elo, path);
        this.maxDepth = maxDepth;
        this.timeBudgetMs = timeBudgetMs;
    }

    getNextAction(game) {
        const { action, depthReached, elapsedMs } = findBestAction(game, {
            maxDepth: this.maxDepth,
            timeBudgetMs: this.timeBudgetMs,
        });
        console.log(`[AI] ${this.name} (elo ${this.elo}) -> profondeur ${depthReached}/${this.maxDepth} atteinte en ${elapsedMs.toFixed(0)}ms`);
        return action;
    }
}
