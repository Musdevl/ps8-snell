import { MinimaxAi } from "./MinimaxAi.js";
import { weightsWithAggression } from "../ai.js";

/** Joueur occasionnel : voit venir les tirs, laisse encore passer des gaffes. */
export class PatrickBizot extends MinimaxAi {

    constructor(id) {
        super(id, "Patrick Bizot", 750, "/assets/ais/patrick-bizot-ai.png", {
            maxDepth: 3,
            timeBudgetMs: 500,
            blunderRate: 0.4,
            blunderPool: 8,
            weights: weightsWithAggression(1.0),
        });
    }
}
