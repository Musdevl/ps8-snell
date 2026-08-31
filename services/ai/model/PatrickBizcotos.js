import { MinimaxAi } from "./MinimaxAi.js";
import { weightsWithAggression } from "../ai.js";

/** Bon club : rate rarement une tactique, commence a chercher l'initiative. */
export class PatrickBizcotos extends MinimaxAi {

    constructor(id) {
        super(id, "Patrick Bizcotos", 1500, "/assets/ais/patrick-bizcotos-ai.png", {
            maxDepth: 5,
            timeBudgetMs: 1200,
            blunderRate: 0.15,
            blunderPool: 4,
            weights: weightsWithAggression(1.15),
        });
    }
}
