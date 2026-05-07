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
    snell_coins.addEventListener('click', async (e) => {
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


document.querySelector("social-bar").addEventListener("update-notification-dot", async () => {
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


// ── Shop — rendu ─────────────────────────────────────────────────────────────

async function fetchShopItems() {
    const res = await accountService.authFetch(`${GATEWAY_URL}/api/shop/daily-items`);
    if (!res.ok) console.error('Failed to retrieve shop items');
    return res.json();
}

function createItemDiv(item, classes) {
    const totalPrice = getTotalPrice(item);
    const colorClass = getColorClass(totalPrice);

    const footerHTML = item.owned
        ? `<div class="owned">
               <span class="price-text">Owned</span>
               <img src="/assets/owned_shop.png" class="owned-ico">
           </div>`
        : `<div class="price">
               <img src="/assets/snell-coin.png" class="snell-coin-img">
               <span class="price-text">${totalPrice.toLocaleString()}</span>
           </div>`;

    const div = document.createElement('div');
    div.classList.add(...classes, colorClass);
    div.innerHTML = `
        <img src="${item.global_picture}" class="item-img">
        <div class="footer-container">
            <section class="footer-upper">
                <span class="item-name">${item.name}</span>
                <span class="item-type">${item.type}</span>
            </section>
            ${footerHTML}
        </div>
    `;

    div.addEventListener('click', () => openPopup(item));
    return div;
}

async function renderShop() {

    const shopItemList = await fetchShopItems();

    const items = shopItemList.items.slice(0, 6);

    if (accountService.isLoggedIn()) {
        markOwnedItems(items);
    }

    const featuredList = document.querySelector('.item-featured-list');
    const shopList = document.getElementById('shop-list');

    featuredList.innerHTML = '';
    shopList.innerHTML = '';

    items.slice(0, 2).forEach(item => featuredList.appendChild(createItemDiv(item, ['item-featured'])));
    items.slice(2, 6).forEach(item => shopList.appendChild(createItemDiv(item, ['item-normal'])));
}

function markOwnedItems(items) {
    const ownedItems = [
        ...accountService.getProfilePictureList(),
        ...accountService.getThemes(),
        ...accountService.getEmotes(),
    ];

    items.forEach(item => {
        let fullyOwned = true;

        item.content.forEach(it => {
            if (ownedItems.find(owned => owned.id === it.id)) {
                item.owned = true;
            } else {
                fullyOwned = false;
            }
        });

        item.fully_owned = fullyOwned;
    });
}


// ── Shop — popup ─────────────────────────────────────────────────────────────

const social_bar = document.querySelector('social-bar');
const overlay = document.getElementById('shop-overlay');
const popupImg = document.getElementById('popup-img');
const popupName = document.getElementById('popup-name');
const popupType = document.getElementById('popup-type');
const popupHeader = document.getElementById('popup-header');
const popupPriceText = document.getElementById('popup-price-text');
const popupContentList = document.getElementById('popup-content-list');
const popupFooter = document.querySelector('.popup-footer');
const popupOwnedFooter = document.querySelector('.popup-owned-footer');

function openPopup(item) {
    const totalPrice = getTotalPrice(item);
    const colorClass = getColorClass(totalPrice);

    // Header
    popupImg.src = item.global_picture;
    popupImg.style.border = `5px solid ${ITEM_BORDER_COLORS[colorClass]}`;
    popupName.textContent = item.name;
    popupType.textContent = item.content?.[0]?.type || '';
    popupHeader.style.background = ITEM_GRADIENTS[colorClass];

    // Prix
    popupPriceText.textContent = totalPrice.toLocaleString();

    // Contenu
    popupContentList.innerHTML = '';
    item.content.forEach(c => {
        const div = document.createElement('div');
        div.classList.add('popup-content-item');
        div.innerHTML = `
            <img src="${c.picture || '/assets/default_item.png'}" alt="${c.name}">
            <span>${c.name || c.type}</span>
        `;
        popupContentList.appendChild(div);
    });

    // Footer : achat ou "déjà possédé"
    const isOwned = item.fully_owned;
    popupFooter.classList.toggle('hidden', isOwned);
    popupOwnedFooter.classList.toggle('hidden', !isOwned);

    if (!isOwned) {
        document.querySelector('.popup-purchase-btn').onclick = () => purchaseItem(item);
    }

    overlay.classList.remove('hidden');
}

function closePopup() {
    overlay.classList.add('hidden');
}

async function purchaseItem(item) {
    if (!accountService.isLoggedIn()) {
        window.location.replace('./pages/auth/login');
        return;
    }

    try {
        const purchaseRes = await accountService.authFetch(`${GATEWAY_URL}/api/shop/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, userId: accountService.getUserId() }),
        });

        if (!purchaseRes.ok) {
            const result = await purchaseRes.json();
            throw new Error(result.message);
        }

        // Mise à jour du compte local
        const userRes = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${accountService.getUserId()}`);
        const user = await userRes.json();
        accountService.setAccount(user);

        social_bar.updateSnellCoins();
        closePopup();
        await renderShop();
        notify('Item successfully Purchased', 'success');

    } catch (error) {
        console.error(error);
        notify(error.message, 'error');
    }
}

document.getElementById('popup-close').addEventListener('click', closePopup);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });


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

await renderShop();
await renderChat();