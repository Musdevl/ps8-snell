import { AbstractAi } from "./AbstractAi.js";
import { findBestAction, DEFAULT_WEIGHTS } from "../ai.js";

/**
 * IA generique basee sur la recherche minimax (voir search/).
 *
 * Toutes les personnalites du ladder derivent de cette classe et ne font que
 * fournir un profil. Trois leviers independants reglent la force :
 *
 *  - maxDepth / timeBudgetMs : jusqu'ou la recherche descend. Le budget temps
 *    fait foi, la profondeur n'est qu'un plafond : l'approfondissement iteratif
 *    rend toujours un coup valide avant l'echeance.
 *  - blunderRate / blunderPool : frequence et amplitude des erreurs. C'est ce
 *    qui distingue une IA faible d'une IA rapide.
 *  - weights.aggression : > 1 valorise les menaces et l'exposition du roi
 *    adverse, < 1 privilegie la securite du sien.
 */
export class MinimaxAi extends AbstractAi {

    constructor(id, name, elo, path, profile = {}) {
        super(id, name, elo, path);
        this.profile = {
            maxDepth: 4,
            timeBudgetMs: 1000,
            blunderRate: 0,
            blunderPool: 1,
            weights: DEFAULT_WEIGHTS,
            ...profile,
        };
    }

    getNextAction(game) {
        const result = findBestAction(game, this.profile);
        console.log(
            `[AI] ${this.name} (${this.elo} Elo) -> ${result.action} | profondeur ${result.depthReached}/${this.profile.maxDepth}`
            + ` | ${result.nodes} noeuds en ${result.elapsedMs.toFixed(0)}ms | score ${formatScore(result.score)}`
        );
        return result.action;
    }
}

function formatScore(score) {
    return Math.abs(score) > 900_000 ? (score > 0 ? "mat" : "mate") : score.toFixed(0);
}
