import { GATEWAY_URL } from "../../env.js";
import * as accountService from "../../services/account-service.js";

class NavBar extends HTMLElement {
    play_btn; shop_btn; social_btn; profile_btn;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });
    }

    async connectedCallback() {
        const response = await fetch("/components/nav-bar/index.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.play_btn = this.shadowRoot.querySelector('.play-btn');
        this.shop_btn = this.shadowRoot.querySelector('.shop-btn');
        this.social_btn = this.shadowRoot.querySelector('.social-btn');
        this.profile_btn = this.shadowRoot.querySelector('.profile-btn');

        this.play_btn.addEventListener("click", () => this._navigate('play'));
        this.shop_btn.addEventListener("click", () => this._navigate('shop'));
        this.social_btn.addEventListener("click", () => this._navigate('social'));
        this.profile_btn.addEventListener('click', () => {
            if (accountService.isLoggedIn()) {
                window.location.replace(`/pages/profile/index.html?username=${accountService.getUserName()}`);
            } else {
                window.location.replace(`/pages/auth/login/index.html`);
            }
        });

        this._updateActiveButton();

        this.profile_ico = this.shadowRoot.querySelector('.profile-ico');
        if (accountService.isLoggedIn()) {
            this.refreshProfilePicture();
        }

        await this.refreshNotificationDot();
        this.resolveReady();
    }

    _navigate(section) {
        if (section === 'social' && !accountService.isLoggedIn()) {
            window.location.replace(`/pages/auth/login/index.html`);
        } else {
            window.location.replace(`/pages/home/index.html?section=${section}`)
        }
    }

    _updateActiveButton() {
        let section = new URLSearchParams(window.location.search).get('section') || 'play';
        const sectionMap = {
            'play': this.play_btn,
            'shop': this.shop_btn,
            'social': this.social_btn,
            'profile': this.profile_btn,
        };
        if (window.location.pathname.startsWith("/pages/profile")) {
            section = 'profile';
        }
        this.shadowRoot.querySelectorAll('.nav-item').forEach(b => b.classList.remove('selected'));
        const targetBtn = sectionMap[section] ?? this.play_btn;
        targetBtn?.classList.add('selected');
    }

    refreshProfilePicture() {
        this.profile_ico.src = accountService.getProfilePicture().picture;
    }

    async refreshNotificationDot() {
        const request_count = (await accountService.getFriendsRequests()).length;
        const friend_notification = this.shadowRoot.querySelector('.friend-notification');
        if (request_count > 0) {
            friend_notification.style.display = "flex";
            friend_notification.innerHTML = request_count > 99 ? "99+" : request_count;
        } else {
            friend_notification.style.display = "none";
        }
    }
}

customElements.define('nav-bar', NavBar);