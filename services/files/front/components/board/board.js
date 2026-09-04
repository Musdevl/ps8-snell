import { COLORS } from "../../enum/Colors.js";
import * as Uint16Utils from '../../utils/Uint16Utils.js';
import * as boardUtils from '../../utils/BoardUtils.js';
import { BoardRenderer } from './renderer/board-renderer.js';
import { PIECE_NAME } from "../../enum/Pieces.js";
import { DIRECTIONS } from "../../enum/Directions.js";

class Board extends HTMLElement {
    colorTurn;
    selectedCase;
    nearSelectedCases;
    playerColor;
    availableCells;
    unavailableCells;
    boardOrientationColor;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.gridState = boardUtils.createEmptyBoard();

        this.readyPromise = new Promise(resolve => {
            this.resolveReady = resolve;
        });

        this.selectedCase = null;
        this.nearSelectedCases = [];
        this.availableCells = [];
        this.unavailableCells = [];
        this.playerColor = null;
    }

    _isMobile() {
        return window.matchMedia('(max-width: 64em)').matches;
    }

    _computeCellSize(measuredWidth) {
        if (this._isMobile()) {
            const size = Math.floor((measuredWidth - 16) / 10);
            return size > 0 ? size : 0;
        }
        return 75;
    }

    async connectedCallback() {

        const response = await fetch("/components/board/board.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;

        this.shadowRoot.appendChild(templateContent.cloneNode(true));



        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));



        this.cellSize = this._computeCellSize(document.documentElement.clientWidth);



        const gridCanvas = this.shadowRoot.querySelector('#grid-canvas');
        const piecesCanvas = this.shadowRoot.querySelector('#pieces-canvas');
        const laserCanvas = this.shadowRoot.querySelector('#laser-canvas');
        const highlightCanvas = this.shadowRoot.querySelector('#highlight-canvas');
        const interactionCanvas = this.shadowRoot.querySelector('#interaction-canvas');

        this._applyContainerSize();

        this.boardRenderer = new BoardRenderer(
            this.cellSize,
            gridCanvas,
            piecesCanvas,
            laserCanvas,
            interactionCanvas,
            highlightCanvas
        );

        this.whiteInventory = [];
        this.blackInventory = [];

        // L'orientation peut avoir été fixée avant que le renderer n'existe.
        this.boardRenderer.setFlipped(this.boardOrientationColor === COLORS.BLACK);

        await this.boardRenderer.render(this.gridState);

        this.boardRenderer.onCellClick((position) => { this.selectPiece(position); });

        this._resizePending = false;
        this._resizePending = false;
        this._resizeObserver = new ResizeObserver(() => {
            if (this._resizePending) return;
            this._resizePending = true;
            requestAnimationFrame(() => {
                this._resizePending = false;
                this._onResize();
            });
        });
       
        this._resizeObserver.observe(document.documentElement);


        this.resolveReady();
    }

    disconnectedCallback() {
        this._resizeObserver?.disconnect();
    }

    _onResize() {
        const measuredWidth = document.documentElement.clientWidth;

        if (!measuredWidth || measuredWidth <= 0) return;

        const newCellSize = this._computeCellSize(measuredWidth);

        if (newCellSize === this.cellSize) return;

        this.cellSize = newCellSize;
        this._applyContainerSize();
        this.boardRenderer.resize(this.cellSize);
        this.boardRenderer.renderGrid(this.gridState);
    }

    _applyContainerSize() {
        const size = `${this.cellSize * 10}px`;
        const container = this.shadowRoot.querySelector('.grid-container');
        container.style.width = size;
        container.style.height = size;
    }

    /**
     * @param {Object} data  état de jeu renvoyé par le serveur
     * @param {Object} [options]
     * @param {boolean} [options.animate=true]  rejouer l'animation de la
     *        dernière action. À mettre à false quand l'état affiché ne suit
     *        pas celui d'avant (review : retour arrière, saut direct), sinon
     *        on animerait un coup depuis une position qui n'existait pas.
     */
    async updateBoard(data, { animate = true } = {}) {
        this.colorTurn = data.colorTurn;
        this.gameId = data.gameId;
        await this.updateGridWithAnimation(data, animate);
        await this.updateLaser(data.laserBeam, data.killedPiecePos);
    }

    async updateGridWithAnimation(data, animate = true) {
        await this.readyPromise;

        const previousGridState = this.gridState;
        const newGridState = Uint16Utils.parseBytesGrid(data.grid);
        const killedPositions = data.killedPiecePos ?? [];

        const intermediateState = newGridState.map(row => [...row]);
        for (const [row, col] of killedPositions) {
            intermediateState[row][col] = previousGridState?.[row]?.[col] ?? null;
        }

        if (animate && data.lastAction && previousGridState) {
            await this.boardRenderer.animateAction(data.lastAction, previousGridState, intermediateState);
        }

        this.gridState = newGridState;

        if (!data.laserBeam || data.laserBeam.length === 0) {
            this.boardRenderer.renderGrid(this.gridState);
        } else {
            this.boardRenderer.renderGrid(intermediateState);
        }
    }

    showPlaceCases() {
        if (this.playerColor === this.colorTurn) {
            this.nearSelectedCases = [];
            this.selectedCase = null;
            let cells = boardUtils.getAvailableCells(this.gridState, this.colorTurn);
            this.availableCells = cells.availableCells;
            this.unavailableCells = cells.unavailableCells;

            this.boardRenderer.highLightAllAvailableCell(this.availableCells);
            this.boardRenderer.highLightAllUnavailableCells(this.unavailableCells);
        }
    }

    hidePlaceCases() {
        this.boardRenderer.clearInteractions();
        this.availableCells = [];
        this.unavailableCells = [];
    }

    setPlayerColor(color) {
        this.playerColor = color;
    }

    /**
     * Assombrit tout le plateau sauf les cases demandées — le « projecteur »
     * du tutoriel, pour montrer où poser une pièce.
     *
     * @param {Array} cells  [{row, col}] ou [[row, col]], coordonnées logiques
     * @param {Object} [options]  {dim, dimColor, outline, outlineColor, pulse}
     */
    async highlightCells(cells, options = {}) {
        await this.readyPromise;
        this.boardRenderer.highlightCells(cells, options);
    }

    async clearHighlightedCells() {
        await this.readyPromise;
        this.boardRenderer.clearHighlightedCells();
    }

    /**
     * Oriente le plateau selon le camp depuis lequel on regarde la partie :
     * jouer les noirs, c'est s'asseoir en face, donc le plateau tourne de 180°.
     * Les coordonnées manipulées par le jeu ne bougent pas d'un pouce, seule
     * la façon de les dessiner change.
     *
     * Volontairement séparé de setPlayerColor : en partie locale ce dernier
     * reçoit la couleur du TRAIT, qui alterne à chaque coup, alors que
     * l'orientation doit rester fixe pendant toute la partie. À n'appeler que
     * là où le joueur occupe un seul camp.
     */
    setBoardOrientation(color) {
        this.boardOrientationColor = color;

        if (this.boardRenderer?.setFlipped(color === COLORS.BLACK)) {
            this.boardRenderer.renderGrid(this.gridState);
        }
    }

    selectPiece(position) {
        const { row, col } = position;

        if (this.isNearSelectedCase(position)) {
            if (this.gridState[row][col] && this.gridState[row][col].pieceName === "shooter" | this.gridState[row][col].pieceName === "king") {
                this.swap(position);
            } else {
                this.move(position);
            }
            return;
        }

        if (this.gridState[row][col] !== null && this.colorTurn === this.playerColor) {
            this.selectNewPiece(row, col, position);
            return;
        }

        if (this.colorTurn === this.playerColor && this.availableCells.some(c => c.row === row && c.col === col)) {
            this.makeAction("PLACE/" + row + col);
            return;
        }

        this.clearSelection();
    }

    isNearSelectedCase(position) {
        return this.nearSelectedCases.some(pos => pos.row === position.row && pos.col === position.col);
    }

    move(destination) {
        const move = `MOVE/${this.selectedCase.row}${this.selectedCase.col},${destination.row}${destination.col}`;
        this.makeAction(move);
        this.clearSelection();
    }

    swap(destination) {
        const swap = `SWAP/${this.selectedCase.row}${this.selectedCase.col},${destination.row}${destination.col}`;
        this.makeAction(swap);
        this.clearSelection();
    }

    selectNewPiece(row, col, current) {
        this.clearSelection();

        const piece = this.gridState[row][col];
        if (piece.color !== this.colorTurn) return;

        this.dispatchEvent(new CustomEvent("piece-selected", {
            detail: piece,
            bubbles: true,
            composed: true
        }));

        this.nearSelectedCases = boardUtils.getNearCases(this.gridState, row, col);
        this.selectedCase = current;

        this.boardRenderer.highlightCell(row, col);

        if (piece.pieceName !== PIECE_NAME[3] && piece.pieceName !== PIECE_NAME[5]) {
            this.boardRenderer.showNearCases(this.nearSelectedCases);
        }
    }

    clearSelection() {
        if (this.selectedCase !== null) { this.boardRenderer.clearCell(this.selectedCase.row, this.selectedCase.col); }
        this.nearSelectedCases = [];
        this.selectedCase = null;
        this.boardRenderer.clearInteractions();
        this.dispatchEvent(new CustomEvent("clear-rotation-cell", {
            bubbles: true,
            composed: true
        }));
    }

    makeAction(action) {
        const data = { action, gameId: this.gameId };
        this.dispatchEvent(new CustomEvent("action", {
            detail: data,
            bubbles: true,
            composed: true
        }));
        this.boardRenderer.clearInteractions();
    }

    async updateGrid(gridBuffers) {
        await this.readyPromise;
        this.gridState = Uint16Utils.parseBytesGrid(gridBuffers);
        this.boardRenderer.renderGrid(this.gridState);
    }

    async updateLaser(laserBeam, killedPositions = []) {
        await this.readyPromise;
        if (!laserBeam || laserBeam.length === 0) return;

        if (this._laserTimeout) {
            clearTimeout(this._laserTimeout);
            this._laserTimeout = null;
        }

        await this.boardRenderer.renderLaser(laserBeam, killedPositions);
        this.boardRenderer.renderGrid(this.gridState);

        this._laserTimeout = setTimeout(() => {
            this.boardRenderer.clearLaser();
            this._laserTimeout = null;
        }, 2000);
    }

    rotate(color, direction) {
        if (color !== this.colorTurn) return;
        if (this.selectedCase) {
            const piece = this.gridState[this.selectedCase.row]?.[this.selectedCase.col];
            if (!piece || piece.color !== color) return;
            if (direction !== DIRECTIONS.EAST && direction !== DIRECTIONS.WEST) return;
            this.makeAction(`ROTATE/${this.selectedCase.row}${this.selectedCase.col},${direction}`);
        }
    }

    clear() {
        this.clearSelection();
        this.boardRenderer.clearHighlightedCells();
        this.boardRenderer.gridRenderer.clearGrid();
        this.boardRenderer.clearPieces();
    }
}

customElements.define('game-board', Board);