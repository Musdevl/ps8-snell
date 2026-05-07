const PERSONALITIES = [
    { id: 'gargamel', name: 'Gargamel', img: '/assets/register/gargamel.jpg', answer: 'liar' },
    { id: 'bizcoto', name: 'Patrick Bizcoto', img: '/assets/register/bizcoto.png', answer: 'liar' },
    { id: 'mathias', name: 'Mathias Prime', img: '/assets/register/mathias.png', answer: 'liar' },
    { id: 'tapie', name: 'Le Boss (Allez l\'OM)', img: '/assets/register/tapie.jpg', answer: 'honest' },
    { id: 'deyann', name: 'Filet o Fish', img: '/assets/register/deyann.png', answer: 'honest' },
];

class QuestionDrag extends HTMLElement {
    async connectedCallback() {
        const response = await fetch("/components/register/questions/questionDrag/index.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.renderPersonalities();
        this.setupDropZones();
    }

    renderPersonalities() {
        const container = this.shadowRoot.getElementById('personalities');

        PERSONALITIES.forEach(p => {
            const el = document.createElement('div');
            el.className = 'personality';
            el.draggable = true;
            el.dataset.id = p.id;
            el.innerHTML = `
                <img src="${p.img}" alt="${p.name}" class="personnality-picture">
                <span class="personnality-name">${p.name}</span>
            `;

            // ── Drag (desktop) ──
            el.addEventListener('dragstart', () => {
                el.classList.add('dragging');
                this._dragging = p.id;
            });
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                this._dragging = null;
            });

            // ── Touch (mobile) ──
            el.addEventListener('touchstart', (e) => {
                this._dragging = p.id;
                this._touchEl = el;
                el.classList.add('dragging');

                const ghost = el.cloneNode(true);
                ghost.id = 'touch-ghost';
                ghost.style.cssText = `
                    position: fixed;
                    pointer-events: none;
                    opacity: 0.7;
                    z-index: 9999;
                    transform: translate(-50%, -50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.4rem;
                `;

                const ghostImg = ghost.querySelector('img');
                if (ghostImg) {
                    ghostImg.style.width = '60px';
                    ghostImg.style.height = '60px';
                    ghostImg.style.borderRadius = '50%';
                    ghostImg.style.objectFit = 'cover';
                }

                const ghostSpan = ghost.querySelector('span');
                if (ghostSpan) ghostSpan.style.display = 'none';

                document.body.appendChild(ghost);
                this._ghost = ghost;
                this._moveGhost(e.touches[0]);
            }, { passive: true });

            el.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this._moveGhost(e.touches[0]);
                this._highlightZone(e.touches[0]);
            }, { passive: false });

            el.addEventListener('touchend', (e) => {
                el.classList.remove('dragging');
                this._ghost?.remove();
                this._ghost = null;

                const touch = e.changedTouches[0];
                const target = this._getDropTarget(touch);
                if (target) {
                    target.appendChild(el);
                }

                this._clearHighlights();
                this._dragging = null;
                this._touchEl = null;
            });

            container.appendChild(el);
        });
    }

    _moveGhost(touch) {
        if (!this._ghost) return;
        this._ghost.style.left = `${touch.clientX}px`;
        this._ghost.style.top = `${touch.clientY}px`;
    }

    _getDropTarget(touch) {
        // Cherche la drop zone ou le container personalities sous le doigt
        const els = this.shadowRoot.elementsFromPoint
            ? this.shadowRoot.elementsFromPoint(touch.clientX, touch.clientY)
            : [];

        // elementsFromPoint ne traverse pas le shadow DOM — on utilise document
        const docEls = document.elementsFromPoint(touch.clientX, touch.clientY);

        const zones = [
            this.shadowRoot.getElementById('drop-honest'),
            this.shadowRoot.getElementById('drop-liar'),
            this.shadowRoot.getElementById('personalities'),
        ];

        for (const zone of zones) {
            const rect = zone.getBoundingClientRect();
            if (
                touch.clientX >= rect.left &&
                touch.clientX <= rect.right &&
                touch.clientY >= rect.top &&
                touch.clientY <= rect.bottom
            ) {
                return zone;
            }
        }
        return null;
    }

    _highlightZone(touch) {
        this._clearHighlights();
        const target = this._getDropTarget(touch);
        if (target && target.classList.contains('drop-zone')) {
            target.classList.add('drag-over');
        }
    }

    _clearHighlights() {
        this.shadowRoot.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    setupDropZones() {
        ['drop-honest', 'drop-liar'].forEach(zoneId => {
            const zone = this.shadowRoot.getElementById(zoneId);

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });
            zone.addEventListener('drop', () => {
                zone.classList.remove('drag-over');
                if (!this._dragging) return;
                const el = this.shadowRoot.querySelector(`.personality[data-id="${this._dragging}"]`);
                if (el) zone.appendChild(el);
                this._dragging = null;
            });
        });

        const personalities = this.shadowRoot.getElementById('personalities');
        personalities.addEventListener('dragover', (e) => e.preventDefault());
        personalities.addEventListener('drop', () => {
            if (!this._dragging) return;
            const el = this.shadowRoot.querySelector(`.personality[data-id="${this._dragging}"]`);
            if (el) personalities.appendChild(el);
            this._dragging = null;
        });
    }

    check() {
        const honestZone = this.shadowRoot.getElementById('drop-honest');
        const liarZone = this.shadowRoot.getElementById('drop-liar');

        const inHonest = [...honestZone.querySelectorAll('.personality')].map(el => el.dataset.id);
        const inLiar = [...liarZone.querySelectorAll('.personality')].map(el => el.dataset.id);

        const totalPlaced = inHonest.length + inLiar.length;
        if (totalPlaced < PERSONALITIES.length) return false;

        return PERSONALITIES.every(p => {
            if (p.answer === 'honest') return inHonest.includes(p.id);
            if (p.answer === 'liar') return inLiar.includes(p.id);
        });
    }

    resetChoice() {
        const personalities = this.shadowRoot.getElementById('personalities');
        const honestZone = this.shadowRoot.getElementById('drop-honest');
        const liarZone = this.shadowRoot.getElementById('drop-liar');

        [...honestZone.querySelectorAll('.personality'),
        ...liarZone.querySelectorAll('.personality')].forEach(el => {
            personalities.appendChild(el);
        });
    }
}

customElements.define('question-drag', QuestionDrag);