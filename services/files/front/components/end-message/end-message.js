import * as BoardUtils from '../../utils/BoardUtils.js';
import { COLORS } from "../../enum/Colors.js"

class EndMessage extends HTMLElement {

    color;

    gameType;

    constructor() {
        super();

        this.attachShadow({ mode: 'open' });
        this.gridState = BoardUtils.createEmptyBoard();

        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });

        this.color;

        this.gameType;

        this.message

    }

    async connectedCallback() {
        const response = await fetch("/components/end-message/end-message.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.message = this.shadowRoot.querySelector('#message');

        this.shadowRoot.querySelector('.quit-btn').addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("quit", { bubbles: true, composed: true }));
        })

        this.shadowRoot.querySelector('.play-again').addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("play-again", { bubbles: true, composed: true }));
        })

        this.overlay = this.shadowRoot.querySelector('.overlay');

        this.overlay.style.display = "none";

        this.resolveReady();
    }

    setColor(newColor) { this.color = newColor; }

    setGameType(newGameType) { this.gameType = newGameType }

    loadMessage(newMessage) {

        if (newMessage === "DRAW") {
            this.message.textContent = "It's a Draw !";
        }

        else if (this.gameType === "LOCAL") {
            this.message.textContent = `Congratulation, ${newMessage} won !`;
        }

        else if (this.gameType === "AI" || this.gameType === "MULTI") {

            const hasWon =
                (newMessage === "BLACK" && this.color === COLORS.BLACK) ||
                (newMessage === "WHITE" && this.color === COLORS.WHITE);

            this.message.textContent = hasWon
                ? "Congratulation, You won !"
                : "You lost the game...";
        }

        this.overlay.style.display = "flex";
        this.style.pointerEvents = "all";
    }

    clear() {
        this.overlay.style.display = "None";
        this.style.pointerEvents = "none";
    }

}

customElements.define('end-message', EndMessage);