class EvaluationBar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });
    }

    async connectedCallback() {
        const response = await fetch("/components/evaluation-bar/evaluation-bar.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.blackSide = this.shadowRoot.querySelector('.black-side');
        this.label = this.shadowRoot.querySelector('.score-label');

        this.resolveReady();
    }

    setScore(score) {
        let blackPercent;

        if (score === "1 - 0") {
            blackPercent = 100;
            this.label.textContent = score;
        } else if (score === "0 - 1") {
            blackPercent = 0;
            this.label.textContent = score;
        } else {
            const limitedScore = Math.max(-200, Math.min(200, score));
            blackPercent = 50 - (limitedScore / 200) * 50;
            this.label.textContent = score > 0 ? `+${score}` : `${score}`;
        }

        this.blackSide.style.width = `${blackPercent}%`;
    }
}

customElements.define('evaluation-bar', EvaluationBar);