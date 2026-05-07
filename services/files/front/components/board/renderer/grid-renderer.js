export class GridRenderer {
    #canvas;

    constructor(canvas, cellSize) {
        this.#canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
    }

    draw() {
        const ctx = this.ctx;
        const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const x = col * this.cellSize;
                const y = row * this.cellSize;

                ctx.fillStyle = (row + col) % 2 === 0 ? "#EEEED2" : "#769656";
                ctx.fillRect(x, y, this.cellSize, this.cellSize);

                const isLight = (row + col) % 2 === 0;
                const labelColor = isLight ? "#769656" : "#EEEED2";
                const fontSize = Math.max(9, Math.floor(this.cellSize * 0.22));
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = labelColor;

                if (col === 0) {
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(10 - row, x + 2, y + 2);
                }

                if (row === 9) {
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(cols[col], x + this.cellSize - 2, y + this.cellSize - 2);
                }
            }
        }
    }


    highlightCell(row, col) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;

        // ToDo

    }

    clearCell(row, col) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;

        const isLight = (row + col) % 2 === 0;
        this.ctx.fillStyle = isLight ? "#EEEED2" : "#769656";
        this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

        const cols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
        const labelColor = isLight ? "#769656" : "#EEEED2";
        const fontSize = Math.max(9, Math.floor(this.cellSize * 0.22));
        this.ctx.font = `bold ${fontSize}px sans-serif`;
        this.ctx.fillStyle = labelColor;

        if (col === 0) {
            this.ctx.textAlign = 'left';
            this.tx.textBaseline = 'top';
            this.ctx.fillText(10 - row, x + 2, y + 2);
        }

        if (row === 9) {
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'bottom';
            this.ctx.fillText(cols[col], x + this.cellSize - 2, y + this.cellSize - 2);
        }
    }

    clearGrid() {
        this.draw();
    }

    getCanvas() {
        return this.#canvas;
    }

}