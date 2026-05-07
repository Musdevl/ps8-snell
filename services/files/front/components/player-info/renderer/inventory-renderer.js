import { getTheme } from "../../../services/account-service.js"

// Desktop : 2 colonnes × 7 lignes
const DESKTOP_COLS = 2;
const DESKTOP_ROWS = 7;

// Mobile : 7 colonnes × 2 lignes (rotation 90° du layout)
const MOBILE_COLS = 7;
const MOBILE_ROWS = 2;

export class InventoryRenderer {

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {number} cellSize
     * @param {boolean} horizontal  — true = mode mobile (7×2), false = mode desktop (2×7)
     */
    constructor(canvas, cellSize, horizontal = false) {
        this.canvas     = canvas;
        this.ctx        = canvas.getContext('2d');
        this.cellSize   = cellSize;
        this.horizontal = horizontal;
        this.pieceImages = {};

        this._initCanvas();
        this.hatchPattern = this.createHatchPattern();
    }

    // ─── Dimensions selon le mode ────────────────────────────────────────────

    get cols() { return this.horizontal ? MOBILE_COLS : DESKTOP_COLS; }
    get rows() { return this.horizontal ? MOBILE_ROWS : DESKTOP_ROWS; }

    _initCanvas() {
        this.canvas.width  = this.cols * this.cellSize;
        this.canvas.height = this.rows * this.cellSize;
    }

    resize(cellSize) {
        this.cellSize = cellSize;
        this._initCanvas();
        this.hatchPattern = this.createHatchPattern();
    }

    // ─── Draw ─────────────────────────────────────────────────────────────────

    draw(pieces) {
        this.clear();
        const ctx = this.ctx;
        ctx.filter = "none";

        ctx.strokeStyle = "#b0b09e";
        ctx.lineWidth   = 1;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * this.cellSize;
                const y = row * this.cellSize;
                ctx.fillStyle = "#EEEED2";
                ctx.fillRect(x, y, this.cellSize, this.cellSize);
                ctx.strokeRect(x, y, this.cellSize, this.cellSize);
            }
        }

        let index_pos = 0;

        pieces.forEach((piece) => {
            if (piece) {
                const colored = piece.cooldown === 0;

                if (this.horizontal) {
                    // 7 colonnes × 2 lignes
                    // index_pos 0 → (row=1, col=6), index_pos 1 → (row=0, col=6), ...
                    const col = this.cols - 1 - Math.floor(index_pos / 2);
                    const row = this.rows - 1 - (index_pos % 2);
                    this.drawPiece(piece, row, col, colored);
                } else {
                    // Desktop original : 2 colonnes × 7 lignes
                    const row = 6 - Math.floor(index_pos / 2);
                    const col = 1 - index_pos % 2;
                    this.drawPiece(piece, row, col, colored);
                }

                index_pos++;
            }
        });
    }

    drawPiece(piece, row, col, colored) {
        const colorNames = { 0: 'white', 8: 'black' };
        const img = this.pieceImages[`${piece.pieceName}_${colorNames[piece.color]}`];
        if (!img) return;

        const ctx    = this.ctx;
        const cellX  = col * this.cellSize;
        const cellY  = row * this.cellSize;
        const x      = cellX + this.cellSize / 2;
        const y      = cellY + this.cellSize / 2;
        const size   = this.cellSize * 0.8;

        ctx.filter = colored ? "grayscale(0%)" : "grayscale(100%)";

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(piece.rotation * Math.PI / 2);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();

        ctx.filter = "none";

        if (!colored) {
            ctx.fillStyle = this.hatchPattern;
            ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    createHatchPattern() {
        const patternCanvas = document.createElement("canvas");
        const size = 12;
        patternCanvas.width  = size;
        patternCanvas.height = size;
        const pctx = patternCanvas.getContext("2d");
        pctx.strokeStyle = "rgba(0,0,0,0.5)";
        pctx.lineWidth   = 2;
        pctx.beginPath();
        pctx.moveTo(0, size);
        pctx.lineTo(size, 0);
        pctx.stroke();
        return this.ctx.createPattern(patternCanvas, "repeat");
    }

    async loadPieceImages() {
        const colors        = ['white', 'black'];
        const loadPromises  = [];
        const theme         = getTheme()?.path ?? "default";

        for (const color of colors) {
            const img = new Image();
            img.src = `/assets/themes/${theme}/pieces/triangle_${color}.png`;
            this.pieceImages[`triangle_${color}`] = img;
            loadPromises.push(new Promise(resolve => img.onload = resolve));
        }

        await Promise.all(loadPromises);
    }
}