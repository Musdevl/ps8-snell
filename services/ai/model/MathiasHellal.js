import { AbstractAi } from "./AbstractAi.js";

export class MathiasHellal extends AbstractAi {

    constructor(id) {
        super(id, "Mathias Hellal", 500, "/assets/ais/mathias-hellal-ai.png");
    }

    getNextAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }

}