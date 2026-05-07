export class InteractionRenderer {
    canvas;

    constructor(canvas, cellSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
    }

    showNearCases(cells) {
        this.clear();

        cells.forEach(({ row, col, isPiece}) => {
            if(isPiece) this.drawCircleOnPiece(row, col);
            else this.drawPointNearPiece(row, col);
        });
    }

    drawCircleOnPiece(row, col) {

        // Draw only circle border

        const x = col * this.cellSize;
        const y = row * this.cellSize;

        const ctx = this.ctx;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(63, 63, 63, 0.6)';
        ctx.fillStyle = 'rgba(63, 63, 63, 0)';
        ctx.lineWidth = 4;
        ctx.arc(
            x + this.cellSize / 2,
            y + this.cellSize / 2,
            this.cellSize / 2.2,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
    }

    drawPointNearPiece(row, col) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;

        const ctx = this.ctx;

        // --- Rectangle ---
        ctx.beginPath();
        // ctx.fillStyle = "rgba(0, 255, 50, 0.5)";
        // ctx.strokeStyle = "#000000";
        // ctx.lineWidth = 1;

        // ctx.fillRect(x, y, this.cellSize, this.cellSize);
        // ctx.strokeRect(x, y, this.cellSize, this.cellSize);

        // --- Cercle ---
        ctx.beginPath();
        ctx.fillStyle = 'rgba(63, 63, 63, 0.3)';
        ctx.arc(
            x + this.cellSize / 2,
            y + this.cellSize / 2,
            this.cellSize / 6,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = 'rgba(109, 109, 109, 0.3)';
        ctx.lineWidth = 2;
        // ctx.stroke();
    }

    showUnavailableCells(cells) {
        cells.forEach(({ row, col }) => {
            this.drawUnavailableCell(row, col);
        })
    }

    drawUnavailableCell(row, col) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        const ctx = this.ctx;

        // --- Rectangle de fond ---
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 50, 50, 0.3)";
        // ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, this.cellSize, this.cellSize);
        // ctx.strokeRect(x, y, this.cellSize, this.cellSize);

        // --- Hachures diagonales (clippées dans la cellule) ---
        ctx.save(); // Sauvegarder le contexte
        ctx.beginPath();
        ctx.rect(x, y, this.cellSize, this.cellSize); // Définir la zone de clipping
        ctx.clip(); // Activer le clipping

        ctx.beginPath();
        ctx.strokeStyle = "rgba(150, 0, 0, 0.5)";
        ctx.lineWidth = 1.5;

        const spacing = this.cellSize / 5;

        // Hachures diagonales
        for (let i = -this.cellSize; i < this.cellSize * 2; i += spacing) {
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + this.cellSize, y + this.cellSize);
        }

        ctx.stroke();
        ctx.restore(); // Restaurer le contexte (désactive le clipping)
    }


    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}