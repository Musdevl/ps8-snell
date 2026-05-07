export class Board {

    grid;

    constructor() {
        this.grid = new Array(10);
        for (let row = 0; row < 10; row++) {
            this.grid[row] = new Uint8Array(10);
        }
    }

    getGrid() {
        return this.grid;
    }

    getSlot(x, y) {
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            return this.grid[x][y];
        }
        else {
            throw new Error("Invalid Coordinates while getting a slot");
        }
    }

    setSlot(x, y, piece) {
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            this.grid[x][y] = piece;
        } else {
            throw new Error("Invalid Coordinates while setting a slot");
        }
    }

    killSlot(row, col) {
        if (row >= 0 && row < 10 && col >= 0 && col < 10) {
            this.grid[row][col] = 0
            //ToDo : Faire verification si triangle mettre dans la pile
        }
        else {
            throw new Error("Invalid Coordinates while killing a slot");
        }
    }

    clone() {
        const cloned = new Board();
        cloned.grid = this.grid.map(row => new Uint8Array(row)); // Uint8Array → copie binaire
        return cloned;
    }
}