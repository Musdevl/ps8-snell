
class ReviewAnalytics extends HTMLElement {


    action_list;
    action_content;
    gameId;
    isPlaying;
    play_pause_btn;

    constructor() {
        super();

        this.attachShadow({ mode: 'open' });
        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });

        this.action_list = [];

        this.action_content = null;

        this.isPlaying = false;

        this.play_pause_btn = null;
    }

    async connectedCallback() {
        // Charger le template
        const response = await fetch("/components/review-analytics/review-analytics.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.action_content = this.shadowRoot.querySelector('.action-section');

        this.render_all_actions(this.action_list);

        this.shadowRoot.querySelector('#next-action-btn').addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("next", { bubbles: true, composed: true }))
            this.pause();
        });

        this.shadowRoot.querySelector('#previous-action-btn').addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("previous", { bubbles: true, composed: true }))
            this.pause();
        });

        this.shadowRoot.querySelector('#first-action-btn').addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("first", { bubbles: true, composed: true }))
            this.pause();
        });

        this.shadowRoot.querySelector('#last-action-btn').addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("last", { bubbles: true, composed: true }))
            this.pause();
        });

        this.play_pause_btn = this.shadowRoot.querySelector("#play-action-btn");

        this.play_pause_btn.addEventListener("click", () => this.play());

    }

    play() {
        const event = this.isPlaying ? "pause" : "play";

        this.dispatchEvent(new CustomEvent(event), {
            bubbles: true,
            composed: true
        })

        this.play_pause_btn.src = this.isPlaying ? "/assets/play-action.svg" : "/assets/pause-action.svg";

        this.isPlaying = !this.isPlaying;

    }

    setGameId(gameId) {
        this.gameId = gameId;
    }

    setActions(actions) {
        this.action_list = actions;
        this.render_all_actions(this.action_list);
    }

    pause() {
        if (this.isPlaying) {
            this.play_pause_btn.src = this.isPlaying ? "/assets/play-action.svg" : "/assets/pause-action.svg";
            this.dispatchEvent(new CustomEvent("pause"), {
                bubbles: true,
                composed: true
            })
            this.isPlaying = false;
        }
    }

    render_action(action, action_number, _class) {
        const template = document.createElement('template');
        let span;
        // Action classique
        if (action.split("/").length === 2) {

            template.innerHTML =
                `<span class="action-item ${_class}-bg" id="${action_number}">
            <span>${action_number}.</span> 
            <span class="${_class}-rect"></span>
            <span>${formatAction(action)}</span>
            </span>`;

            span = template.content.firstElementChild;

            span.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('go-to', {
                    detail: { index: action_number+1 },
                    bubbles: true,
                    composed: true
                }));
            });

        }
        // Fin de partie
        else {
            template.innerHTML =
                `<span class="action-item ${_class}-bg" id="${action_number}">
            <span>${action_number}.</span> 
            <span>${action}</span>
            </span>`;

            span = template.content.firstElementChild;

            span.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('last', {
                    bubbles: true,
                    composed: true
                }));
            });
        }

        this.action_content.appendChild(span);

    }

    render_all_actions(actions) {
        const rendered_actions = actions.slice(1, -1); // enlève premier et dernier

        for (let i = 0; i < rendered_actions.length; i++) {
            this.render_action(
                rendered_actions[i],
                i,
                i % 2 === 0 ? "white" : "black"
            );
        }
    }

    highlight_cell(index) {
        const items = this.shadowRoot.querySelectorAll('.action-item');
        items.forEach(item => item.classList.remove('selected'));
        items[index - 1]?.classList.add('selected');
    }

}

customElements.define('review-analytics', ReviewAnalytics);

function formatAction(_action) {
    let [action, coords] = _action.split("/");
    action = action[0].toUpperCase() + action.slice(1).toLowerCase();
    return `${action} - ${coords}`;
}