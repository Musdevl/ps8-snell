import { AbstractAi } from "./AbstractAi.js";

export class HardAi extends AbstractAi {

    constructor(id) {
        super(id, "Patrick Bizot", 1500, "/assets/ais/hard-ai.png");
    }

    getBestAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }
}