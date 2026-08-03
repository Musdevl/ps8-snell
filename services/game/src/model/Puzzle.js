export class Puzzle {

    name;
    number;
    initBoard;
    steps;

    constructor(name, number, initBoard, steps) {
        this.initBoard = initBoard
        this.steps = steps;
        this.name = name;
        this.number = number;
    }

    getSteps() { return this.steps; }

    setSteps(steps) { this.steps = steps; }

    getInitBoard(board) { this.initBoard = board; }

    getName() { return this.name; }

    getNumber() { return this.number; }

};