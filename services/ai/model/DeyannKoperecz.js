import { AbstractAi } from "./AbstractAi.js";

export class DeyannKoperecz extends AbstractAi {

    constructor(id, name = "Deyann Koperecz", elo = 1200, path = "/assets/ais/deyann-koperecz-ai.png") {
        super(id, name, elo, path);
    }

    getNextAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }
}