import { MinimaxAi } from "./MinimaxAi.js";
import { weightsWithAggression } from "../ai.js";

/**
 * Debutant : voit le coup suivant mais se trompe plus d'une fois sur deux,
 * et pioche large quand il se trompe. Timide sur l'attaque.
 */
export class MathiasHellal extends MinimaxAi {

    constructor(id) {
        super(id, "Mathias Hellal", 500, "/assets/ais/mathias-hellal-ai.png", {
            maxDepth: 1,
            timeBudgetMs: 300,
            blunderRate: 0.6,
            blunderPool: 12,
            weights: weightsWithAggression(0.85),
        });
    }
}
