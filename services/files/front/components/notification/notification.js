import { GATEWAY_URL } from "../../env.js";
import * as accountService from "../../services/account-service.js";

let _LocalNotifications;

try {
    const { LocalNotifications } = Capacitor.Plugins;
    _LocalNotifications = LocalNotifications;
} catch (error) {
    console.log("[Notification]", error)
}

// // Demander la permission (à faire au démarrage de l'app)
async function requestNotificationPermission() {
    if (_LocalNotifications) {
        const { display } = await _LocalNotifications.requestPermissions();
        return display === 'granted';
    }
}

// Envoyer une notification
async function sendNotification(title, body) {
    if (_LocalNotifications) {
        await _LocalNotifications.schedule({
            notifications: [
                {
                    title,
                    body,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 100) }
                }
            ]
        });
    }
}

class NotificationBar extends HTMLElement {

    achievement_sound;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.achievement_sound = new Audio(`${GATEWAY_URL}/assets/sounds/achievement.mp3`);
    }

    async connectedCallback() {
        const response = await fetch("/components/notification/notification.html");
        const content = await response.text();
        const template = new DOMParser().parseFromString(content, "text/html").querySelector("template").content;
        this.shadowRoot.appendChild(template.cloneNode(true));

        this.container = this.shadowRoot.querySelector("#notification-container");

        window.addEventListener('notify', async (e) => {
            await this.show(e.detail.message, e.detail.type, e.detail.data, e.detail.duration);
        });

        await requestNotificationPermission();
    }

    async show(message, type = 'info', data, duration = 3500) {

        const el = document.createElement('div');
        el.className = `notification ${type}`;

        if (type === 'achievement' && data && data.picture) {
            el.innerHTML += `
            <img src="${GATEWAY_URL}${data.picture}" class="notif-picture">
        `;
            this.playAchievementSound();
        }

        el.innerHTML += `
            <div class="notification-dot"></div>
            <span>${message}</span>
        `;

        if (type === 'challenge') {
            el.innerHTML +=
                `
                <img src="${GATEWAY_URL}/assets/check.svg" class="accept-challenge" alt="accept-challenge">
                <img src="${GATEWAY_URL}/assets/cross.svg" class="deny-challenge" alt="deny-challenge">
            `;

            await sendNotification("Challenge Received !");

            el.querySelector('.accept-challenge').addEventListener('click', async () => {
                try {
                    const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/challenge/accept`,
                        {
                            method: 'POST',
                            body: JSON.stringify(
                                [
                                    accountService.getUserId(),
                                    data.from.userId
                                ]
                            )
                        }
                    );
                } catch (error) {
                    console.log("[Notification]", error);
                }
            })

            el.querySelector('.deny-challenge').addEventListener('click', () => {
                console.log("[Notification] Challenge Denied");
            })
        }

        this.container.appendChild(el);

        setTimeout(() => {
            el.classList.add('hiding');
            el.addEventListener('transitionend', () => el.remove());
        }, duration);
    }

    playAchievementSound() {
        this.achievement_sound.currentTime = 0;
        this.achievement_sound.play().catch(() => { });
    }
}

customElements.define('notification-bar', NotificationBar);