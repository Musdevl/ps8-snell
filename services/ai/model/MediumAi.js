import { AbstractAi } from "./AbstractAi.js";

export class MediumAi extends AbstractAi {

    constructor(id) {
        super(id, "Deyann Koperecz", 1000, "/assets/ais/medium-ai.png");
    }

    getNextAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }
}