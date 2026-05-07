import { LaserRenderer } from "./laser-renderer.js";
import { GridRenderer } from "./grid-renderer.js";
import { InteractionRenderer } from "./interaction-renderer.js";
import { PiecesRenderer } from "./piece-renderer.js";
import * as BoardUtils from "../../../utils/BoardUtils.js";

const CELL_NUMBER_IN_A_ROW = 10;

export class BoardRenderer {

    constructor(cellSize,
        gridCanvas,
        piecesCanvas,
        laserCanvas,
        interactionCanvas) {

        this.cellSize = cellSize;
        this.boardSize = cellSize * CELL_NUMBER_IN_A_ROW;

        // Garder les références pour le resize
        this.gridCanvas        = gridCanvas;
        this.piecesCanvas      = piecesCanvas;
        this.laserCanvas       = laserCanvas;
        this.interactionCanvas = interactionCanvas;

        this._initAllCanvas();

        // Créer les renderers
        this.gridRenderer        = new GridRenderer(gridCanvas, cellSize);
        this.piecesRenderer      = new PiecesRenderer(piecesCanvas, cellSize);
        this.laserRenderer       = new LaserRenderer(laserCanvas, cellSize);
        this.interactionRenderer = new InteractionRenderer(interactionCanvas, cellSize);

        laserCanvas.addEventListener('piece-killed', (e) => {
            const { row, col } = e.detail;
            this.piecesRenderer.clearCell(row, col);
        });
    }

    // ─── Canvas init / resize ────────────────────────────────────────────────

    _initCanvas(canvas) {
        canvas.width  = this.boardSize;
        canvas.height = this.boardSize;
    }

    _initAllCanvas() {
        this._initCanvas(this.gridCanvas);
        this._initCanvas(this.piecesCanvas);
        this._initCanvas(this.laserCanvas);
        this._initCanvas(this.interactionCanvas);
    }

    /**
     * Appelé par Board quand la fenêtre est redimensionnée.
     * Met à jour cellSize, redimensionne tous les canvas,
     * et propage la nouvelle taille à chaque sous-renderer.
     */
    resize(cellSize) {
        this.cellSize  = cellSize;
        this.boardSize = cellSize * CELL_NUMBER_IN_A_ROW;

        this._initAllCanvas();

        // Propager aux sous-renderers (ils ont tous un this.cellSize)
        this.gridRenderer.cellSize        = cellSize;
        this.piecesRenderer.cellSize      = cellSize;
        this.laserRenderer.cellSize       = cellSize;
        this.interactionRenderer.cellSize = cellSize;

        // Redessiner la grille de fond (statique)
        this.gridRenderer.draw();
    }

    // ─── Rendering ───────────────────────────────────────────────────────────

    async render(boardState) {
        await this.piecesRenderer.loadPieceImages();
        this.gridRenderer.draw();
        this.piecesRenderer.draw(boardState);
    }

    renderGrid(gridState) {
        this.piecesRenderer.draw(gridState);
    }

    renderLaser(laserBeam, killedPositions = []) {
        return new Promise(resolve => {
            this.laserRenderer.animate(laserBeam, killedPositions, 600, resolve);
        });
    }

    clearLaser() {
        this.laserRenderer.reset();
    }

    highlightCell(row, col)      { this.gridRenderer.highlightCell(row, col); }
    clearCell(row, col)          { this.gridRenderer.clearCell(row, col); }
    showNearCases(cases)         { this.interactionRenderer.showNearCases(cases); }
    clearInteractions()          { this.interactionRenderer.clear(); }
    clearPieces()                { this.piecesRenderer.clearPieces(); }

    highLightAllAvailableCell(availableCells)     { this.interactionRenderer.showNearCases(availableCells); }
    highLightAllUnavailableCells(unavailableCells) { this.interactionRenderer.showUnavailableCells(unavailableCells); }

    onCellClick(callback) {
        this.interactionRenderer.canvas.addEventListener('click', (e) => {
            const position = BoardUtils.getClickPosition(e, this.cellSize);
            callback(position, e);
        });
    }

    // ─── Animations ──────────────────────────────────────────────────────────

    async animateAction(lastAction, previousGridState, newGridState) {
        if (!lastAction || !previousGridState) return;

        const [type, coords] = lastAction.split('/');

        if (type === 'ROTATE') {
            const [posStr, deltaStr] = coords.split(',');
            const row   = parseInt(posStr[0]);
            const col   = parseInt(posStr[1]);
            const delta = parseInt(deltaStr);

            const piece = previousGridState[row][col];
            if (!piece) return;

            const fromDir  = piece.direction;
            const deltaRad = delta === 16 ? -Math.PI / 2 : Math.PI / 2;

            await this.piecesRenderer.animateRotation(piece, row, col, fromDir, deltaRad);

        } else if (type === 'MOVE') {
            const [fromStr, toStr] = coords.split(',');
            const fromRow = parseInt(fromStr[0]);
            const fromCol = parseInt(fromStr[1]);
            const toRow   = parseInt(toStr[0]);
            const toCol   = parseInt(toStr[1]);

            const piece = previousGridState[fromRow][fromCol];
            if (!piece) return;

            await this.piecesRenderer.animateMove(piece, fromRow, fromCol, toRow, toCol);

        } else if (type === 'SWAP') {
            const [fromStr, toStr] = coords.split(',');
            const fromRow = parseInt(fromStr[0]);
            const fromCol = parseInt(fromStr[1]);
            const toRow   = parseInt(toStr[0]);
            const toCol   = parseInt(toStr[1]);

            const pieceA = previousGridState[fromRow][fromCol];
            const pieceB = previousGridState[toRow][toCol];
            if (!pieceA || !pieceB) return;

            await this.piecesRenderer.animateSwap(pieceA, fromRow, fromCol, pieceB, toRow, toCol, previousGridState);

        } else if (type === 'PLACE') {
            const row   = parseInt(coords[0]);
            const col   = parseInt(coords[1]);
            const piece = newGridState[row][col];
            if (!piece) return;

            await this.piecesRenderer.animatePlace(piece, row, col, newGridState);
        }
    }
}