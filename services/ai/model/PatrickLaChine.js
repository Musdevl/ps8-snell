import { AbstractAi } from "./AbstractAi.js";

export class PatrickLaChine extends AbstractAi {

    constructor(id) {
        super(id, "Patrick La Chine", 100, "/assets/ais/patrick-la-chine-ai.png");
    }

    getBestAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }
}