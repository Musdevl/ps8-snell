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
            this.pause();
            this.dispatchEvent(new CustomEvent("next", { bubbles: true, composed: true }))
        });

        this.shadowRoot.querySelector('#previous-action-btn').addEventListener("click", () => {
            this.pause();
            this.dispatchEvent(new CustomEvent("previous", { bubbles: true, composed: true }))
        });

        this.shadowRoot.querySelector('#first-action-btn').addEventListener("click", () => {
            this.pause();
            this.dispatchEvent(new CustomEvent("first", { bubbles: true, composed: true }))
        });

        this.shadowRoot.querySelector('#last-action-btn').addEventListener("click", () => {
            this.pause();
            this.dispatchEvent(new CustomEvent("last", { bubbles: true, composed: true }))
        });

        this.play_pause_btn = this.shadowRoot.querySelector("#play-action-btn");

        this.play_pause_btn.addEventListener("click", () => this.toggle());

        // La page attend cette promesse avant d'appeler setActions().
        this.resolveReady();
    }

    /** Bouton play/pause : bascule d'un état à l'autre. */
    toggle() {
        if (this.isPlaying) this.pause();
        else this.play();
    }

    /**
     * L'état interne est mis à jour AVANT l'événement : un auditeur qui
     * rappelle pause() depuis son handler (c'est le cas quand la lecture
     * atteint la fin de partie) retombe alors sur un no-op, au lieu de
     * ré-inverser l'icône et de laisser le composant se croire en lecture.
     */
    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this._renderPlayButton();

        this.dispatchEvent(new CustomEvent("play", { bubbles: true, composed: true }));
    }

    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this._renderPlayButton();

        this.dispatchEvent(new CustomEvent("pause", { bubbles: true, composed: true }));
    }

    _renderPlayButton() {
        if (!this.play_pause_btn) return;
        this.play_pause_btn.src = this.isPlaying
            ? "/assets/pause-action.svg"
            : "/assets/play-action.svg";
    }

    setGameId(gameId) {
        this.gameId = gameId;
    }

    /**
     * @param {string[]} actions  uniquement les coups réellement joués, dans
     *        l'ordre : ni "INIT", ni le résultat de la partie. La page les a
     *        déjà filtrés pour qu'ils correspondent un pour un aux positions.
     */
    setActions(actions) {
        this.action_list = actions ?? [];
        this.render_all_actions(this.action_list);
    }

    render_action(action, action_number, _class) {
        const template = document.createElement('template');
        let span;

        // `action_number` est l'indice 0-based du coup ; la position qu'il
        // produit est l'état n° action_number + 1. C'est ce numéro-là qu'on
        // affiche et qu'on envoie dans l'événement.
        const state_index = action_number + 1;

        // Action classique
        if (action.split("/").length === 2) {

            template.innerHTML =
                `<span class="action-item ${_class}-bg" id="action-${action_number}">
            <span>${state_index}.</span> 
            <span class="${_class}-rect"></span>
            <span>${formatAction(action)}</span>
            </span>`;

            span = template.content.firstElementChild;

            span.addEventListener('click', () => {
                this.pause();
                this.dispatchEvent(new CustomEvent('go-to', {
                    detail: { index: state_index },
                    bubbles: true,
                    composed: true
                }));
            });

        }
        // Fin de partie
        else {
            template.innerHTML =
                `<span class="action-item ${_class}-bg" id="action-${action_number}">
            <span>${state_index}.</span> 
            <span>${action}</span>
            </span>`;

            span = template.content.firstElementChild;

            span.addEventListener('click', () => {
                this.pause();
                this.dispatchEvent(new CustomEvent('last', {
                    bubbles: true,
                    composed: true
                }));
            });
        }

        this.action_content.appendChild(span);

    }

    render_all_actions(actions) {
        // Le composant peut recevoir ses actions avant d'être monté : dans ce
        // cas on ne dessine rien, connectedCallback rappellera cette méthode.
        if (!this.action_content) return;

        this.action_content.replaceChildren();

        for (let i = 0; i < actions.length; i++) {
            this.render_action(
                actions[i],
                i,
                i % 2 === 0 ? "white" : "black"
            );
        }
    }

    /**
     * @param {number} index  numéro de la position affichée : 0 = position de
     *        départ (aucun coup surligné), k = position après le k-ième coup,
     *        c'est-à-dire l'élément d'indice k - 1 dans la liste.
     */
    highlight_cell(index) {
        const items = this.shadowRoot.querySelectorAll('.action-item');
        items.forEach(item => item.classList.remove('selected'));

        const current = items[index - 1];
        if (!current) return;

        current.classList.add('selected');
        current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

}

customElements.define('review-analytics', ReviewAnalytics);

function formatAction(_action) {
    let [action, coords] = _action.split("/");
    action = action[0].toUpperCase() + action.slice(1).toLowerCase();
    return `${action} - ${coords}`;
}
