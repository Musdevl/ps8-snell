import * as chatService from '../../services/chat-service.js';
import * as accountService from '../../services/account-service.js';
import { GATEWAY_URL } from '../../env.js';
import { notify } from '../../services/notification-service.js';

// ── Constantes ──────────────────────────────────────────────────────────────

const ITEM_GRADIENTS = {
    goldbg: 'radial-gradient(circle, #edac20 0%, #ed6f20 60%, #a03308 100%)',
    purplebg: 'radial-gradient(circle, #9b72e0 0%, #7752b2 50%, #452c6a 100%)',
    bluebg: 'radial-gradient(circle, #60b5ff 0%, #3da1f6 50%, #194468 100%)',
    greenbg: 'radial-gradient(circle, #47a822 0%, #2c7619 60%, #035201 100%)',
};

const ITEM_BORDER_COLORS = {
    goldbg: '#a03308',
    purplebg: '#452c6a',
    bluebg: '#194468',
    greenbg: '#035201',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getColorClass(price) {
    if (price >= 2000) return 'goldbg';
    if (price >= 1500) return 'purplebg';
    if (price >= 800) return 'bluebg';
    return 'greenbg';
}

function getTotalPrice(item) {
    return item.content.reduce((sum, it) => sum + it.unit_price, 0);
}


// ── Navigation (nav-bar responsive) ─────────────────────────────────────────

if (accountService.isLoggedIn()) {

    const snell_coins = document.getElementById('snell-coins');
    snell_coins.textContent = accountService.getSnellCoins();
    const add_coins = document.querySelector('.snell-coins-container');
    console.log(add_coins);
    add_coins.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('[BUY] Initiating checkout...');

        const userId = accountService.getUserId();
        if (!userId) {
            console.error("User ID non trouvé");
            return;
        }

        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/shop/create-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Pas d'URL Stripe reçue", data);
            }
        } catch (err) {
            console.error('[BUY] Fetch error:', err);
        }
    });
} else {
    document.querySelector('.snell-coins-container').style.display = "none";
}


const navBar = document.querySelector('nav-bar');


const social_bar = document.querySelector("social-bar");

social_bar.addEventListener("update-notification-dot", async () => {
    await navBar.refreshNotificationDot();
})

document.querySelector(".mobile-logo-container").addEventListener("click", () => {
    history.pushState({}, '', '?section=play');
    showSection('play-section');
})


const sections = {
    'play-section': document.getElementById('play-section'),
    'shop-section': document.getElementById('shop-section'),
    'social-section': document.getElementById('social-section'),
};

function showSection(name) {
    const isMiddle = name === 'shop-section';
    document.querySelector('.middle-section')?.classList.toggle('nav-hidden', !isMiddle);

    Object.entries(sections).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle('nav-hidden', key !== name);
    });

    const isMobile = window.innerWidth <= 640;
    const main = document.querySelector('main');

    if (isMobile) {
        main.style.display = name === 'social-section' ? 'none' : 'flex';
    }
}


try {
    await customElements.whenDefined('nav-bar');
    await navBar.readyPromise;
    navBar.addEventListener('selection', (e) => showSection(e.detail));
} catch (e) {
    console.warn('nav-bar non disponible :', e);
}

const urlSectionMap = {
    'play': 'play-section',
    'shop': 'shop-section',
    'social': 'social-section',
};

const currentSection = new URLSearchParams(window.location.search).get('section') || 'play';
const initialSection = urlSectionMap[currentSection] ?? 'play-section';

showSection(initialSection);


// ── Sélecteurs de temps (Local / Multiplayer) ────────────────────────────────

['local', 'multiplayer'].forEach(mode => {
    const btn = document.getElementById(`${mode}-btn`);
    const selector = document.getElementById(`${mode}-time-selector`);

    btn.addEventListener('click', () => selector.classList.toggle('hidden'));

    document.addEventListener('click', (e) => {
        const clickedOutside = !btn.contains(e.target) && !selector.contains(e.target);
        if (clickedOutside) selector.classList.add('hidden');
    });
});

// ── Shop ─────────────────────────────────────────────────────────────────────

const shop = document.getElementById('global-shop');
await customElements.whenDefined('shop-component');
await shop.readyPromise;
await shop.render();

shop.addEventListener('purchase-success', () => {
    social_bar.updateSnellCoins();
});

// ── Chat global ───────────────────────────────────────────────────────────────

async function renderChat() {
    const chat = document.getElementById('global-chat');
    await customElements.whenDefined('chat-component');
    await chat.readyPromise;

    // Configuration du composant
    chat.disableOptionButtons();
    chat.disableDrawButton();
    chat.disableForfeitButton();
    chat.addBorderRadiusToBackground(10);

    // Chargement de l'historique
    const allMessages = await chatService.getAllMessagesGlobal();

    chat.setChat(allMessages.messages);

    // Réception des nouveaux messages en temps réel
    chatService.onMessage((message) => chat.addNewMessage(message));

    if (!accountService.isLoggedIn()) {
        chat.disableInputs();
        return;
    }

    chat.addEventListener('send-message', async (e) => {
        e.detail.message.userId = accountService.getUserId();
        try {
            await chatService.postMessageGlobal(e.detail.message);
        } catch (error) {
            if (error.status === 422) chat.show_invalid_message();
        }
    });
}

function playSound(sound) {
    sound.play().catch((e) => { console.log(e) });
}


// ── Init ──────────────────────────────────────────────────────────────────────
await renderChat();