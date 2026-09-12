import * as gameService from "../../services/game-service.js";
import * as accountService from "../../services/account-service.js"

let STORAGE_KEY = "CHAT";

class Chat extends HTMLElement {

    userInput;

    chat_content;

    message_list;

    displayed_message_list;

    emote_section;

    error_message;

    draw_button;

    forfeit_button;

    leave_chat_btn;

    chat_scroll;

    typing_indicator;

    typing_avatars;

    // Dernier etat "en train d'ecrire" envoye, pour ne dispatcher que les changements.
    is_typing = false;


    constructor() {
        super();

        this.userInput = '';

        this.send_message_btn = null;

        this.chat_content = '';

        this.message_list = [];

        this.displayed_message_list = [];

        this.emote_section = null;

        this.draw_button = null;

        this.leave_chat_btn = null;

        this.leave_chat_btn = null;

        this.forfeit_button = null;

        this.error_message = null;

        this.attachShadow({ mode: 'open' });
        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });
    }

    async connectedCallback() {
        const response = await fetch("/components/chat/chat.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.userInput = this.shadowRoot.querySelector('.user-input');

        this.userInput.addEventListener('keydown', (e) => {
            const val = this.userInput.value;
            if (e.key === 'Enter' && !e.shiftKey && val.trim() !== '') {
                e.preventDefault();
                this.sendMessage(val, "text");
            }
        });

        this.userInput.addEventListener('input', () => {
            this.updateTypingState(this.userInput.value.trim() !== '');
        });

        this.send_message_btn = this.shadowRoot.querySelector('.send-message-btn');
        this.chat_scroll = this.shadowRoot.querySelector('.chat-section');
        this.chat_content = this.shadowRoot.querySelector('.messages');
        this.typing_indicator = this.shadowRoot.querySelector('.typing-indicator');
        this.typing_avatars = this.shadowRoot.querySelector('.typing-avatars');
        this.emote_section = this.shadowRoot.querySelector('.emote-section');
        this.leave_chat_btn = this.shadowRoot.querySelector('.mobile-leave-chat');
        this.leave_chat_btn = this.shadowRoot.querySelector('.mobile-leave-chat');

        this.emote_section.addEventListener('wheel', e => {
            e.preventDefault();
            this.emote_section.scrollLeft += e.deltaY + e.deltaX;
        });

        this.emote_section.addEventListener('click', e => {
            if (e.target.classList.contains('emote-item')) {
                this.sendMessage(e.target.src, "emote")
            }
        });

        this.send_message_btn.addEventListener("click", () => {
            const val = this.userInput.value;
            if (val && val.trim() !== '') {
                this.sendMessage(this.userInput.value, "text");
            }
        })

        this.leave_chat_btn.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("leave-chat"), {
                detail: {
                    bubbles: true,
                    composed: true
                }
            })
        })

        this.leave_chat_btn.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("leave-chat"), {
                detail: {
                    bubbles: true,
                    composed: true
                }
            })
        })

        this.forfeit_button = this.shadowRoot.querySelector('.forfeit-btn');
        this.forfeit_button.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent("ask-forfeit", {
                detail: {
                    bubbles: true,
                    composed: true
                }
            }));
        })


        this.draw_button = this.shadowRoot.querySelector('.draw-btn');
        this.draw_button.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent("ask-draw", {
                detail: {
                    bubbles: true,
                    composed: true
                }
            }));
        })

        this.error_message = this.shadowRoot.querySelector('.error-message');

        this.renderEmotes()

        this.resolveReady();
    }

    sendMessage(value, kind) {
        const message = { value, kind };
        this.dispatchEvent(new CustomEvent("send-message", {
            detail: {
                message: message,
                bubbles: true,
                composed: true
            }
        }));

        if (kind === "text") {
            this.userInput.value = '';
            // Vider le champ par code ne declenche pas 'input', on signale la fin de saisie a la main.
            this.updateTypingState(false);
        }
    }

    updateTypingState(isTyping) {
        if (isTyping === this.is_typing) return;
        this.is_typing = isTyping;
        this.dispatchEvent(new CustomEvent("typing", { detail: { isTyping } }));
    }

    isTyping() {
        return this.is_typing;
    }

    // users : [{ userId, username, picture }]. Liste vide => indicateur masque.
    setTypingUsers(users) {
        if (!Array.isArray(users) || users.length === 0) {
            this.typing_indicator.hidden = true;
            this.typing_avatars.innerHTML = '';
            return;
        }

        this.typing_avatars.innerHTML = users
            .map(u => `<img class="chat-profile-picture" src="${u.picture}" title="${u.username}">`)
            .join('');

        const wasHidden = this.typing_indicator.hidden;
        this.typing_indicator.hidden = false;
        if (wasHidden) this.scrollToBottom();
    }

    scrollToBottom() {
        this.chat_scroll.scrollTop = this.chat_scroll.scrollHeight;
    }


    addNewMessage(message) {
        this.message_list.push(message);
        this.renderMessage(message);
    }

    show_invalid_message() {
        const invalid_message_field = this.shadowRoot.querySelector('.error-message');
        invalid_message_field.innerHTML += "Unauthorized Message"
        setTimeout(() => invalid_message_field.innerHTML = "", 1500);

    }

    renderMessage(message) {
        const lastMessage = this.displayed_message_list[this.displayed_message_list.length - 1];

        const showHeader = !lastMessage || lastMessage.username !== message.username //|| (message.date - lastMessage.date) // > 2 * 60 * 1000 Superieur à 2 minutes

        const is_my_message = accountService.isLoggedIn() && accountService.getUserId() == message.userId ? 'self' : 'not-self';

        const header = showHeader && is_my_message !== 'self' ?

            `<div class="message-header">
            <img class="chat-profile-picture" src=${message.picture}> 
            <span>${message.username}</span>
            <span class="chat-hour">
            ${this.formatDate(message.date)}
            </span>
        </div>` : '';

        switch (message.kind) {
            case "text":
                this.chat_content.innerHTML += `
                <div class="message-container ${is_my_message}">
                    ${header}
                    <span class="message">${message.value}</span>
                </div>`;
                break;
            case "emote":
                this.chat_content.innerHTML += `
                <div class="message-container ${is_my_message}">
                    ${header}
                    <img class="emote" src="${message.value}">
                </div>`;
                break;
        }


        this.displayed_message_list.push(message)

        this.scrollToBottom();
    }

    disableInputs() {
        this.shadowRoot.querySelector(".emote-section").style.display = "none";
        this.shadowRoot.querySelector(".error-message-section").style.display = "none";
        this.shadowRoot.querySelector(".typing-section").style.display = "none";
        this.shadowRoot.querySelector(".chat-wrapper").style.setProperty("grid-template-rows", "auto 1fr");
    }

    renderEmotes() {
        const emotes = accountService?.getSelectedEmotes();
        if (!Array.isArray(emotes)) return;

        for (let i = 0; i < emotes.length; i++) {
            const emote = emotes[i];
            // Un slot vide (null) n'a rien a envoyer dans le chat.
            if (!emote || typeof emote.picture !== 'string') continue;
            this.emote_section.innerHTML += `<img src="${emote.picture}" class="emote-item">`;
        }
    }

    setChat(message_list) {
        this.message_list = message_list;
        for (let i = 0; i < this.message_list.length; i++) {
            this.renderMessage(this.message_list[i].message);
        }
    }

    clearContent() {
        this.message_list = [];
        if (this.chat_content) this.chat_content.innerHTML = '';
        if (this.typing_indicator) this.setTypingUsers([]);
        this.resetErrorMessage();
    }

    setErrorMessage(message) {
        this.error_message.innerHTML = `${message}`;

        clearTimeout(this._errorTimeout);
        this._errorTimeout = setTimeout(() => {
            this.resetErrorMessage();
        }, 5000);
    }

    resetErrorMessage() {
        this.error_message.innerHTML = "";
        clearTimeout(this._errorTimeout);
    }

    disableDrawButton() {
        this.draw_button.style.display = 'none';
    }

    disableForfeitButton() {
        this.forfeit_button.style.display = 'none';
    }

    disableOptionButtons() {
        this.shadowRoot.querySelector('.option-section').style.display = 'none';
        this.shadowRoot.querySelector('.chat-wrapper').style.setProperty('grid-template-rows', '0.01fr 1fr auto auto 0.2fr');
    }


    formatDate(date) {
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    addBorderRadiusToBackground(radius) {
        this.shadowRoot.querySelector('.chat-wrapper').style.setProperty('border-radius', `${radius}px`);
    }

}

customElements.define('chat-component', Chat);