import { AbstractAi } from "./AbstractAi.js";
import { getRandomAction } from "../ai.js";

/**
 * IA de référence : joue un coup légal au hasard, sans évaluation.
 */
export class RandomAi extends AbstractAi {
    getNextAction(game) {
        return getRandomAction(game);
    }
}
