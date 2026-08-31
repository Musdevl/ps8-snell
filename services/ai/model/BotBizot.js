import { MinimaxAi } from "./MinimaxAi.js";
import { weightsWithAggression } from "../ai.js";

/**
 * Sommet du ladder : aucune erreur volontaire et le profil le plus mordant.
 * maxDepth est volontairement hors d'atteinte, c'est le budget temps qui
 * decide jusqu'ou l'approfondissement iteratif descend.
 */
export class BotBizot extends MinimaxAi {

    constructor(id) {
        super(id, "Bot Bizot", 1500, "/assets/ais/bot-bizot-ai.png", {
            maxDepth: 20,
            timeBudgetMs: 2500,
            blunderRate: 0,
            weights: weightsWithAggression(1.3),
        });
    }
}
