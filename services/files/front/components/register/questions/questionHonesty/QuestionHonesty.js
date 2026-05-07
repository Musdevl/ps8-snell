class QuestionHonesty extends HTMLElement {
    async connectedCallback() {
        const response = await fetch("/components/register/questions/questionHonesty/index.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.shadowRoot.querySelectorAll('.choice').forEach(btn => {
            btn.addEventListener('click', () => {
                this.shadowRoot.querySelectorAll('.choice').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }

    check() {
        const selected = this.shadowRoot.querySelector('.choice.selected');
        if (!selected) return false;
        return selected.dataset.value === 'no';
    }

    resetChoice() {
        this.shadowRoot.querySelectorAll('.choice').forEach(b => b.classList.remove('selected'));
    }


}

customElements.define('question-honesty', QuestionHonesty);