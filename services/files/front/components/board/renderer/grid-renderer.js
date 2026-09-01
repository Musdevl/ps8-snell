const COLUMN_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const LIGHT_CELL = "#EEEED2";
const DARK_CELL = "#769656";

/**
 * Damier et libellés de coordonnées.
 *
 * C'est le seul canvas qui ne reçoit pas la transformation d'orientation :
 * un texte tourné avec le plateau serait à l'envers. Il convertit donc
 * lui-même ses coordonnées, ce qui ne concerne en pratique que les libellés :
 * le damier, lui, est inchangé par la rotation, puisque (9-r)+(9-c) a la même
 * parité que r+c.
 */
export class GridRenderer {
    #canvas;

    constructor(canvas, cellSize, orientation) {
        this.#canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
        this.orientation = orientation;
    }

    draw() {
        // On balaye les cases de l'ÉCRAN et on remonte à la case logique :
        // c'est ce qui permet de garder le libellé de la ligne 1 sur le bord
        // gauche et celui des colonnes en bas, quel que soit le sens du plateau.
        for (let screenRow = 0; screenRow < 10; screenRow++) {
            for (let screenCol = 0; screenCol < 10; screenCol++) {
                const { row, col } = this.orientation.toLogical(screenRow, screenCol);
                this.#paintCell(screenRow, screenCol, row, col);
            }
        }
    }

    highlightCell(row, col) {
        // ToDo
    }

    /** `row` et `col` sont logiques, comme partout ailleurs dans le jeu. */
    clearCell(row, col) {
        const screen = this.orientation.toScreen(row, col);
        this.#paintCell(screen.row, screen.col, row, col);
    }

    #paintCell(screenRow, screenCol, row, col) {
        const ctx = this.ctx;
        const x = screenCol * this.cellSize;
        const y = screenRow * this.cellSize;

        const isLight = (screenRow + screenCol) % 2 === 0;
        ctx.fillStyle = isLight ? LIGHT_CELL : DARK_CELL;
        ctx.fillRect(x, y, this.cellSize, this.cellSize);

        const fontSize = Math.max(9, Math.floor(this.cellSize * 0.22));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = isLight ? DARK_CELL : LIGHT_CELL;

        // Les libellés restent sur les mêmes bords de l'écran ; seule leur
        // valeur suit la case logique qui se trouve maintenant là.
        if (screenCol === 0) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(10 - row, x + 2, y + 2);
        }

        if (screenRow === 9) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(COLUMN_LABELS[col], x + this.cellSize - 2, y + this.cellSize - 2);
        }
    }

    clearGrid() {
        this.draw();
    }

    getCanvas() {
        return this.#canvas;
    }
}
