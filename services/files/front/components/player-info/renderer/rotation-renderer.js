import { COLORS_NAME as COLORS_NAMES } from "../../../enum/Colors.js";
import { PIECE_NAME as PIECE_NAMES } from "../../../enum/Pieces.js";
import { getTheme } from "../../../services/account-service.js";

export class RotationRenderer {

    constructor(canvas, cellSize) {
        this.canvas      = canvas;
        this.ctx         = canvas.getContext('2d');
        this.cellSize    = cellSize;
        this.pieceImages = {};
        this.selectedPiece = null;
        this.pieceFlipped = false;

        this._initCanvas();
    }

    _initCanvas() {
        this.canvas.width  = this.cellSize;
        this.canvas.height = this.cellSize;
    }

    resize(cellSize) {
        this.cellSize = cellSize;
        this._initCanvas();
        // Redessiner l'état courant après resize
        if (this.selectedPiece) {
            this.drawPiece(this.selectedPiece, this.pieceFlipped);
        } else {
            this.clearCell();
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth   = 3;
        ctx.fillStyle   = "#EEEED2";
        ctx.fillRect(0, 0, this.cellSize, this.cellSize);
        ctx.strokeRect(0, 0, this.cellSize, this.cellSize);

        if (this.selectedPiece) {
            this.drawPiece(this.selectedPiece, this.pieceFlipped);
        }
    }

    /**
     * `flipped` ajoute un demi-tour au dessin, pour que la cellule montre la
     * pièce exactement comme le joueur la voit sur un plateau retourné.
     * C'est l'appelant qui décide : lui seul sait d'où vient la pièce.
     */
    drawPiece(piece, flipped = false) {
        this.clearCell();

        // Mémoriser après le clearCell, qui remet l'état à zéro : sans ça la
        // pièce n'était jamais redessinée après un redimensionnement.
        this.selectedPiece = piece;
        this.pieceFlipped = flipped;

        const colorNames = { 0: 'white', 8: 'black' };
        const img = this.pieceImages[`${piece.pieceName}_${colorNames[piece.color]}`];
        if (!img) return;

        const ctx  = this.ctx;
        const x    = this.cellSize / 2;
        const y    = this.cellSize / 2;
        const size = this.cellSize * 0.8;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(directionToRadians(piece.direction) + (flipped ? Math.PI : 0));
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
    }

    clearCell() {
        this.selectedPiece = null;
        this.pieceFlipped = false;

        this.ctx.fillStyle   = "#EEEED2";
        this.ctx.fillRect(0, 0, this.cellSize, this.cellSize);
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth   = 1;
        this.ctx.strokeRect(0, 0, this.cellSize, this.cellSize);
    }

    async loadPieceImages() {
        const pieces       = Object.values(PIECE_NAMES);
        const colors       = Object.values(COLORS_NAMES);
        const loadPromises = [];
        const theme        = getTheme()?.path ?? "default";

        for (const piece of pieces) {
            for (const color of colors) {
                const img = new Image();
                img.src = `/assets/themes/${theme}/pieces/${piece}_${color}.png`;
                this.pieceImages[`${piece}_${color}`] = img;
                loadPromises.push(new Promise(resolve => img.onload = resolve));
            }
        }

        await Promise.all(loadPromises);
    }
}

function directionToRadians(dir) {
    return (dir / 16) * (Math.PI / 2);
}