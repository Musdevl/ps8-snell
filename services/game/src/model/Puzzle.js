// Le service game embarque ses propres enums : pointer vers ceux du front
// fonctionne avec launch-dev-mode.sh mais pas en conteneur, ou /app/files
// n'existe pas (game/Dockerfile ne copie que helpers et game).
import { COLORS } from "../enum/Colors.js";

export class Puzzle {

    id;
    name;
    game;
    steps;
    hints;
    difficulty;
    game_states;
    playerColor;

    constructor(id, name = "", game, steps = [], hints = [], difficulty, playerColor = COLORS.WHITE) {
        this.id = id;
        this.game = game;
        this.steps = steps;
        this.hints = hints;
        this.name = name;
        this.difficulty = difficulty;
        this.game_states = [];
        this.playerColor = playerColor;
    }

};