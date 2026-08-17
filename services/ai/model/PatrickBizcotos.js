import { AbstractAi } from "./AbstractAi.js";

export class PatrickBizcotos extends AbstractAi {

    constructor(id) {
        super(id, "Patrick Bizcotos", 1000, "/assets/ais/patrick-bizcotos-ai.png");
    }

    getNextAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }
}