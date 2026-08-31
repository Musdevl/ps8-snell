import { MinimaxAi } from "./MinimaxAi.js";

export class DeyannKoperecz extends MinimaxAi {

    constructor(id, name = "Deyann Koperecz", elo = 1200, path = "/assets/ais/deyann-koperecz-ai.png") {
        super(id, name, elo, path, 5, 2500);
    }
}
