import { GATEWAY_URL } from "../../../env.js";
import * as accountService from "../../../services/account-service.js";

export class PiecesRenderer {

    #canvas;
    constructor(canvas, cellSize) {

        this.#canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
        this.pieceImages = {};

        this.theme = accountService.getTheme()?.path ?? "default";
        this.actionSound = new Audio(`${GATEWAY_URL}/assets/themes/${this.theme}/sounds/action.mp3`);
        this.rotateSound = new Audio(`${GATEWAY_URL}/assets/themes/${this.theme}/sounds/rotate.mp3`)
    }

    async loadPieceImages() {
        const pieces = ['shooter', 'king', 'protector', 'full_mirror', 'triangle'];
        const colors = ['white', 'black'];

        const loadPromises = [];



        for (const piece of pieces) {
            for (const color of colors) {
                const img = new Image();
                img.src = `/assets/themes/${this.theme}/pieces/${piece}_${color}.png`;
                this.pieceImages[`${piece}_${color}`] = img;
                loadPromises.push(new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.error(`Image introuvable : /assets/themes/${this.theme}/pieces/${piece}_${color}.svg`);
                        resolve(); // on résout quand même pour ne pas bloquer
                    };
                }));
            }
        }

        await Promise.all(loadPromises);
    }

    draw(gameState) {
        this.ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
                const piece = gameState[row][col];
                if (piece) {
                    this.drawPiece(piece, row, col);
                }
            }
        }
    }

    drawPiece(piece, row, col) {

        const colors = {
            0: 'white',
            8: 'black'
        }

        const img = this.pieceImages[`${piece.pieceName}_${colors[piece.color]}`];

        if (!img) return;

        const ctx = this.ctx;
        const x = col * this.cellSize + this.cellSize / 2;
        const y = row * this.cellSize + this.cellSize / 2;
        const size = this.cellSize * 0.85;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(directionToRadians(piece.direction));
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
    }

    getCanvas() {
        return this.#canvas;
    }

    clearPieces() {
        this.ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }


    async animateRotation(piece, row, col, fromDirection, deltaRad, duration = 350) {
        this.playRotateSound();
        return new Promise(resolve => {
            const start = performance.now();
            const fromRad = directionToRadians(fromDirection);

            const animate = (now) => {
                const elapsed = now - start;
                const t = Math.min(elapsed / duration, 1);
                const eased = easeInOut(t);
                const currentRad = fromRad + deltaRad * eased;

                this.clearCell(row, col);
                this.drawPieceAtAngle(piece, row, col, currentRad);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    async animateMove(piece, fromRow, fromCol, toRow, toCol, duration = 300) {
        this.playActionSound();
        return new Promise(resolve => {
            const start = performance.now();

            const fromX = fromCol * this.cellSize + this.cellSize / 2;
            const fromY = fromRow * this.cellSize + this.cellSize / 2;
            const toX = toCol * this.cellSize + this.cellSize / 2;
            const toY = toRow * this.cellSize + this.cellSize / 2;

            const animate = (now) => {
                const elapsed = now - start;
                const t = Math.min(elapsed / duration, 1);
                const eased = easeInOut(t);

                const x = fromX + (toX - fromX) * eased;
                const y = fromY + (toY - fromY) * eased;

                this.clearCell(fromRow, fromCol);
                this.clearCell(toRow, toCol);
                this.drawPieceAt(piece, x, y);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    async animateSwap(pieceA, fromRow, fromCol, pieceB, toRow, toCol, allPieces, duration = 300) {
        this.playActionSound();
        return new Promise(resolve => {
            const start = performance.now();

            const fromX = fromCol * this.cellSize + this.cellSize / 2;
            const fromY = fromRow * this.cellSize + this.cellSize / 2;
            const toX = toCol * this.cellSize + this.cellSize / 2;
            const toY = toRow * this.cellSize + this.cellSize / 2;

            const animate = (now) => {
                const elapsed = now - start;
                const t = Math.min(elapsed / duration, 1);
                const eased = easeInOut(t);

                this.ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

                for (let r = 0; r < 10; r++) {
                    for (let c = 0; c < 10; c++) {
                        const isMoving =
                            (r === fromRow && c === fromCol) ||
                            (r === toRow && c === toCol);
                        if (!isMoving && allPieces[r][c]) {
                            this.drawPiece(allPieces[r][c], r, c);
                        }
                    }
                }

                this.drawPieceAt(pieceA, fromX + (toX - fromX) * eased, fromY + (toY - fromY) * eased);
                this.drawPieceAt(pieceB, toX + (fromX - toX) * eased, toY + (fromY - toY) * eased);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    async animatePlace(piece, row, col, allPieces, duration = 400) {
        this.playActionSound();
        return new Promise(resolve => {
            const start = performance.now();

            const targetX = col * this.cellSize + this.cellSize / 2;
            const targetY = row * this.cellSize + this.cellSize / 2;
            const startY = targetY - this.cellSize;

            const animate = (now) => {
                const elapsed = now - start;
                const t = Math.min(elapsed / duration, 1);
                const eased = easeOutCubic(t);
                const currentY = startY + (targetY - startY) * eased;

                this.ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

                // Redessine toutes les pièces statiques sauf la destination
                for (let r = 0; r < 10; r++) {
                    for (let c = 0; c < 10; c++) {
                        const isTarget = r === row && c === col;
                        if (!isTarget && allPieces[r][c]) {
                            this.drawPiece(allPieces[r][c], r, c);
                        }
                    }
                }
                this.drawPieceAt(piece, targetX, currentY);

                if (t < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.drawPiece(piece, row, col);
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    playActionSound() {
        this.actionSound.currentTime = 0;
        this.actionSound.play().catch(() => { });
    }

    playRotateSound() {
        this.rotateSound.currentTime = 0;
        this.rotateSound.play().catch(() => { });
    }


    clearCell(row, col) {
        const x = col * this.cellSize;
        const y = row * this.cellSize;
        this.ctx.clearRect(x, y, this.cellSize, this.cellSize);
    }

    drawPieceAtAngle(piece, row, col, angleRad) {
        const colors = { 0: 'white', 8: 'black' };
        const img = this.pieceImages[`${piece.pieceName}_${colors[piece.color]}`];
        if (!img) return;

        const x = col * this.cellSize + this.cellSize / 2;
        const y = row * this.cellSize + this.cellSize / 2;
        const size = this.cellSize * 0.85;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angleRad);
        this.ctx.drawImage(img, -size / 2, -size / 2, size, size);
        this.ctx.restore();
    }

    drawPieceAt(piece, x, y) {
        const colors = { 0: 'white', 8: 'black' };
        const img = this.pieceImages[`${piece.pieceName}_${colors[piece.color]}`];
        if (!img) return;

        const size = this.cellSize * 0.85;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(directionToRadians(piece.direction));
        this.ctx.drawImage(img, -size / 2, -size / 2, size, size);
        this.ctx.restore();
    }
}

function directionToRadians(dir) {
    return (dir / 16) * (Math.PI / 2);
}


function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
