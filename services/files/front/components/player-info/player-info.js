import { DIRECTIONS } from '../../enum/Directions.js';
import * as BoardUtils from '../../utils/BoardUtils.js';
import { InventoryRenderer } from './renderer/inventory-renderer.js';
import { RotationRenderer } from './renderer/rotation-renderer.js';
import * as Uint16Utils from "../../utils/Uint16Utils.js";
import { PIECE_NAME } from '../../enum/Pieces.js';
import { COLORS_NAME } from "../../enum/Colors.js";
import * as accountService from "../../services/account-service.js";

class PlayerInfo extends HTMLElement {

    inventoryRenderer;
    mobileInventoryRenderer;
    inventory;

    inventoryCanvas;
    mobileInventoryCanvas;
    rotationCanvas;

    timerEl;
    inventoryCell;

    color;
    colorTurn;
    playerColor;

    time;
    timerInterval;

    leftArrow;
    rightArrow;
    player_avatar;

    low_timers_sound_played;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });

        this.inventory = [];
        this.inventoryCell = null;
        this.colorTurn = null;
        this.selectedPiece = null;
        this.playerColor = null;
        this.timerInterval = null;
        this.username = null;
        this.player_avatar = null;
        this.elo = null;
        this.time = 0;
        this.low_timers_sound_played = false;

        this.theme = accountService.getTheme()?.path ?? "default";

        this.low_timer_sound = new Audio(`/assets/themes/${this.theme}/sounds/lowtimer.mp3`);
        this.low_timer_sound.preload = 'auto';

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


        const response = await fetch("/components/player-info/player-info.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        // Mesure basée sur la taille réelle du host (et non innerWidth)
        this.cellSize = this._computeCellSize(this.offsetWidth);

        this.inventoryCanvas = this.shadowRoot.querySelector('#inventory-canvas');
        this.mobileInventoryCanvas = this.shadowRoot.querySelector('#mobile-inventory-canvas');
        this.rotationCanvas = this.shadowRoot.querySelector('#rotation-canvas');

        this.mobileInventoryCanvas.height = 0;
        this.inventoryCanvas.height = 0;
        this.rotationCanvas.height = 0;

        this.timerEl = this.shadowRoot.querySelector('.timer');
        this.username = this.shadowRoot.querySelector('.player-name');
        this.elo = this.shadowRoot.querySelector('.player-elo');
        this.player_avatar = this.shadowRoot.querySelector('.player-avatar-picture');
        this.leftArrow = this.shadowRoot.querySelector('.left-arrow');
        this.rightArrow = this.shadowRoot.querySelector('.right-arrow');

        this.inventoryRenderer = new InventoryRenderer(this.inventoryCanvas, this.cellSize, false);
        this.mobileInventoryRenderer = new InventoryRenderer(this.mobileInventoryCanvas, this.cellSize, true);
        this.rotationRenderer = new RotationRenderer(this.rotationCanvas, this.cellSize);

        this._applyArrowSize();

        this.leftArrow.addEventListener('click', () => {
            if (this.inventoryCell) {
                this.rotationRenderer.drawPiece(Uint16Utils.rotatePiece(this.inventoryCell, DIRECTIONS.EAST));
            } else if (this.selectedPiece) {
                this.dispatchEvent(new CustomEvent("rotate", {
                    detail: { color: this.color, direction: DIRECTIONS.EAST },
                    bubbles: true, composed: true
                }));
                this.selectedPiece = null;
            }
        });

        this.rightArrow.addEventListener('click', () => {
            if (this.inventoryCell) {
                this.rotationRenderer.drawPiece(Uint16Utils.rotatePiece(this.inventoryCell, DIRECTIONS.WEST));
            } else if (this.selectedPiece) {
                this.dispatchEvent(new CustomEvent("rotate", {
                    detail: { color: this.color, direction: DIRECTIONS.WEST },
                    bubbles: true, composed: true
                }));
                this.selectedPiece = null;
            }
        });

        this._bindInventoryClick();

        await this.inventoryRenderer.draw([]);
        await this.inventoryRenderer.loadPieceImages();

        await this.mobileInventoryRenderer.draw([]);
        await this.mobileInventoryRenderer.loadPieceImages();

        await this.rotationRenderer.draw();
        await this.rotationRenderer.loadPieceImages();

        this._resizePending = false;
        this._resizeObserver = new ResizeObserver((entries) => {
            this._latestWidth = entries[entries.length - 1].contentRect.width;
            if (this._resizePending) return;
            this._resizePending = true;
            requestAnimationFrame(() => {
                this._resizePending = false;
                this._onResize(this._latestWidth);
            });
        });
        this._resizeObserver.observe(this);

        this.resolveReady();
    }

    disconnectedCallback() { this._resizeObserver?.disconnect(); }

    _onResize(measuredWidth) {

        if (!measuredWidth || measuredWidth <= 0) {
            console.warn('[board] _onResize skipped — invalid width', measuredWidth);
            return;
        }
        const newCellSize = this._computeCellSize(measuredWidth);

        if (newCellSize === this.cellSize) return;
        this.cellSize = newCellSize;

        this.inventoryRenderer.resize(this.cellSize);
        this.mobileInventoryRenderer.resize(this.cellSize);
        this.rotationRenderer.resize(this.cellSize);

        this._applyArrowSize();

        this.inventoryRenderer.draw(this.inventory);
        this.mobileInventoryRenderer.draw(this.inventory);
        this.rotationRenderer.draw();
        if (this.inventoryCell || this.selectedPiece) {
            this.rotationRenderer.drawPiece(this.inventoryCell ?? this.selectedPiece);
        }
    }

    _applyArrowSize() {
        const size = `${this.cellSize * 0.6}px`;
        this.leftArrow.style.width = size;
        this.leftArrow.style.height = size;
        this.rightArrow.style.width = size;
        this.rightArrow.style.height = size;
    }

    // ─── Inventory click binding ──────────────────────────────────────────────

    _bindInventoryClick() {
        const handler = (event) => {
            if (this.selectInventoryPiece(event)) {
                this.dispatchEvent(new CustomEvent("select-inventory-piece",
                    { detail: { color: this.color }, bubbles: true, composed: true }));
            } else {
                this.dispatchEvent(new CustomEvent("clear-interaction-canvas",
                    { bubbles: true, composed: true }));
            }
        };

        this.inventoryCanvas.addEventListener('click', handler);
        this.mobileInventoryCanvas.addEventListener('click', handler);
    }

    // ─── Piece selection ─────────────────────────────────────────────────────

    selectInventoryPiece(event) {
        this.clearRotationCell();

        let row, col;

        // Désolé pour ça, mais ça marche et c'est élégant
        // Aller voir directment Driss.M et Cyril.R pour l'explication c'est chaud en commentaire
        if (this._isMobile()) {
            ({ row, col } = BoardUtils.getClickPosition(event, this.cellSize));
            const index = [13 - col * 2 - row];
            var piece = this.inventory[index];
        } else {
            ({ row, col } = BoardUtils.getClickPosition(event, this.cellSize));
            var piece = this.inventory[13 - row * 2 - col];
        }


        if (piece && piece.color === this.colorTurn && piece.cooldown === 0 && this.playerColor === this.colorTurn) {
            piece.direction = 0;
            this.inventoryCell = piece;

            // Affiche la piece selectionnée dans la cellule de rotation
            this.rotationRenderer.drawPiece(piece);
            return true;
        } else {
            this.selectedInventoryCell = null;
            return false;
        }
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    async updateInventory(inventory) {
        await this.readyPromise;
        this.inventory = Uint16Utils.parseInventory(inventory);
        this.inventoryRenderer.draw(this.inventory);
        this.mobileInventoryRenderer.draw(this.inventory);
    }

    async updateTimer(newTime) {
        await this.readyPromise;
        this.time = newTime;
        this._renderTimer();
    }

    disableRotation() { this.shadowRoot.querySelector('.facing-cell-container').style.opacity = "0"; }
    disableElo() { this.shadowRoot.querySelector('.player-elo').style.display = "none"; }
    disableProfilePicture() {
        this.shadowRoot.querySelector('.player-avatar-picture').style.display = "none";
        this.shadowRoot.querySelector('.player-header').style.gap = "0px";
    }
    disableName() { this.shadowRoot.querySelector('.player-name').style.display = "none"; }
    disableTimer() { this.shadowRoot.querySelector('.timer').style.display = "none"; }

    async setColor(color) {
        this.color = color;
        await this.readyPromise;
        this.shadowRoot.querySelector('.player-info-wrapper').classList.add(COLORS_NAME[color]);
    }

    getSelectedInventoryCell() { return this.inventoryCell; }

    setSelectedPiece(piece) {
        this.clearRotationCell();
        this.selectedPiece = piece;
        this.inventoryCell = null;
        if (piece.pieceName === PIECE_NAME[5]) {
            this.leftArrow.style.opacity = "0";
            this.rightArrow.style.opacity = "0";
        }
        this.rotationRenderer.drawPiece(piece);
    }

    clearRotationCell() {
        this.inventoryCell = null;
        this.selectedPiece = null;
        this.leftArrow.style.opacity = "1";
        this.rightArrow.style.opacity = "1";
        this.rotationRenderer.clearCell();
    }

    setColorTurn(newColorTurn) {
        this.colorTurn = newColorTurn;
        const isMyTurn = this.color === this.colorTurn;
        this.timerEl?.classList.toggle('timer--active', isMyTurn);
        this.timerEl?.classList.toggle('timer--inactive', !isMyTurn);
        this.classList.toggle('inactive', !isMyTurn);
    }

    startTimer() {
        if (this.color === this.colorTurn) {
            clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => {
                if (this.time > 0) {
                    this.time--;
                    this._renderTimer();
                } else {
                    clearInterval(this.timerInterval);
                }
            }, 1000);
        } else {
            this.stopTimer();
        }
    }

    _renderTimer() {
        if (!this.timerEl) return;
        const minutes = String(Math.floor(this.time / 60)).padStart(2, '0');
        const seconds = String(this.time % 60).padStart(2, '0');
        this.timerEl.textContent = `${minutes}:${seconds}`;
        this.timerEl.classList.toggle('timer--low', this.time <= 30 && this.color === this.colorTurn);
        if (this.time <= 30 && this.color === this.colorTurn && !this.low_timers_sound_played) {
            this.low_timer_sound.currentTime = 0;
            this.low_timer_sound.play().catch((e) => { console.error("Audio blocked:", e); });
            this.low_timers_sound_played = true;
        }
    }

    setPlayerColor(playerColor) {
        this.playerColor = playerColor;
    }

    setPlayerInfo(player_info) {
        console.log(player_info)
        this.username.textContent = player_info.username;
        this.elo.textContent = player_info.elo;
        this.player_avatar.src = player_info.picture.picture;
        this.low_timer_sound.load();
    }

    setPlayerName(playerName) { this.username.textContent = playerName; }
    setPlayerAvatar(playerAvatar) { this.player_avatar.src = playerAvatar; }

    async clear() {
        this.clearRotationCell();
        await this.updateInventory([]);
        this.username.innerHTML = "Player Name";
        this.player_avatar.src = "";
        this.elo.innerHTML = "0";
        this.time = 600;
    }

    stopTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    }
}

customElements.define('player-info', PlayerInfo);