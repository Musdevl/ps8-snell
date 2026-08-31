import { MinimaxAi } from "./MinimaxAi.js";
import { weightsWithAggression } from "../ai.js";

/** Fort joueur : profondeur reelle, quasiment plus de gaffes, jeu offensif. */
export class DeyannKoperecz extends MinimaxAi {

    constructor(id, name = "Deyann Koperecz", elo = 1200, path = "/assets/ais/deyann-koperecz-ai.png") {
        super(id, name, elo, path, {
            maxDepth: 8,
            timeBudgetMs: 1800,
            blunderRate: 0.05,
            blunderPool: 2,
            weights: weightsWithAggression(1.2),
        });
    }
}
