export class Puzzle {

    id;
    name;
    game;
    steps;
    difficulty;
    game_states;

    constructor(id, name = "", game, steps = [], difficulty) {
        this.id = id;
        this.game = game;
        this.steps = steps;
        this.name = name;
        this.difficulty = difficulty;
        this.game_states = [];
    }


};