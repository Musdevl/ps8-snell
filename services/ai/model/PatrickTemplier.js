import { MinimaxAi } from "./MinimaxAi.js";
import { weightsWithAggression } from "../ai.js";

/** Joueur regulier : tactique correcte a courte portee, erreurs occasionnelles. */
export class PatrickTemplier extends MinimaxAi {

    constructor(id) {
        super(id, "Patrick Templier", 900, "/assets/ais/patrick-templier-ai.png", {
            maxDepth: 4,
            timeBudgetMs: 800,
            blunderRate: 0.25,
            blunderPool: 5,
            weights: weightsWithAggression(1.1),
        });
    }
}
