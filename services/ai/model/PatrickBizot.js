import { AbstractAi } from "./AbstractAi.js";
import * as engine from "../engine.js";

export class PatrickBizot extends AbstractAi {

    constructor(id) {
        super(id, "Patrick Bizot", 750, "/assets/ais/patrick-bizot-ai.png");
    }

    getNextAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.floor(Math.random() * all_action.length)
        return all_action[random_idx];
    }
}