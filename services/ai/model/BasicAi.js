import { AbstractAi } from "./AbstractAi.js";

export class BasicAi extends AbstractAi {

    constructor(id) {
        super(id, "Mathias Hellal", 100, "/assets/ais/basic-ai.png");
    }

    getNextAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }

}