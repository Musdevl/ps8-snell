import { COLORS } from "../../../files/front/enum/Colors.js";

export class Puzzle {

    id;
    name;
    game;
    steps;
    difficulty;
    game_states;
    playerColor;

    constructor(id, name = "", game, steps = [], difficulty, playerColor = COLORS.WHITE) {
        this.id = id;
        this.game = game;
        this.steps = steps;
        this.name = name;
        this.difficulty = difficulty;
        this.game_states = [];
        this.playerColor = playerColor;
    }

};