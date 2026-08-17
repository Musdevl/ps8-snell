import { AbstractAi } from "./AbstractAi.js";

export class BotBizot extends AbstractAi {

    constructor(id, name = "Bot Bizot", elo = 1500, path = "/assets/ais/bot-bizot-ai.png") {
        super(id, "Bot Bizot", 1500, "/assets/ais/bot-bizot-ai.png");
    }

    getBestAction(game) {
        const all_action = engine.getAllActions(game);
        const random_idx = Math.random() * all_action.length
        return all_action[random_idx];
    }
}