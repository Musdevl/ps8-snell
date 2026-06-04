import * as accountService from '../../services/account-service.js';
import { GATEWAY_URL } from '../../env.js';
import { notify } from '../../services/notification-service.js';

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

function getColorClass(price) {
    if (price >= 2000) return 'goldbg';
    if (price >= 1500) return 'purplebg';
    if (price >= 800) return 'bluebg';
    return 'greenbg';
}

function getTotalPrice(item) {
    return item.content.reduce((sum, it) => sum + it.unit_price, 0);
}

class Shop extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });
    }

    async connectedCallback() {
        const response = await fetch("/components/shop/shop.html");
        const content = await response.text();
        const templateContent = new DOMParser()
            .parseFromString(content, "text/html")
            .querySelector("template").content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        this.shadowRoot.getElementById('popup-close')
            .addEventListener('click', () => this.closePopup());

        this.shadowRoot.getElementById('shop-overlay')
            .addEventListener('click', (e) => {
                if (e.target === this.shadowRoot.getElementById('shop-overlay')) this.closePopup();
            });

        this.resolveReady();
    }

    // ── Rendu ────────────────────────────────────────────────────────────────

    async render() {
        const items = await this.fetchShopItems();

        if (accountService.isLoggedIn()) this.markOwnedItems(items);

        const featuredList = this.shadowRoot.querySelector('.item-featured-list');
        const shopList = this.shadowRoot.getElementById('shop-list');

        featuredList.innerHTML = '';
        shopList.innerHTML = '';

        items.slice(0, 2).forEach(item =>
            featuredList.appendChild(this.createItemDiv(item, ['item-featured']))
        );
        items.slice(2, 6).forEach(item =>
            shopList.appendChild(this.createItemDiv(item, ['item-normal']))
        );
    }

    async fetchShopItems() {
        const res = await accountService.authFetch(`${GATEWAY_URL}/api/shop/daily-items`);
        if (!res.ok) console.error('Failed to retrieve shop items');
        const data = await res.json();
        return data.items.slice(0, 6);
    }

    markOwnedItems(items) {
    const ownedItems = [
        ...accountService.getProfilePictureList(),
        ...accountService.getThemes(),
        ...accountService.getEmotes(),
    ];
    items.forEach(item => {
        item.owned = false;     
        item.fully_owned = false;  
        let fullyOwned = true;
        item.content.forEach(it => {
            if (ownedItems.find(owned => owned.id === it.id)) item.owned = true;
            else fullyOwned = false;
        });
        item.fully_owned = fullyOwned;
    });
}

    createItemDiv(item, classes) {
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
        div.addEventListener('click', () => this.openPopup(item));
        return div;
    }

    // ── Popup ────────────────────────────────────────────────────────────────

    openPopup(item) {
        const sr = this.shadowRoot;
        const totalPrice = getTotalPrice(item);
        const colorClass = getColorClass(totalPrice);

        sr.getElementById('popup-img').src = item.global_picture;
        sr.getElementById('popup-img').style.border = `5px solid ${ITEM_BORDER_COLORS[colorClass]}`;
        sr.getElementById('popup-name').textContent = item.name;
        sr.getElementById('popup-type').textContent = item.content?.[0]?.type || '';
        sr.getElementById('popup-header').style.background = ITEM_GRADIENTS[colorClass];
        sr.getElementById('popup-price-text').textContent = totalPrice.toLocaleString();

        const contentList = sr.getElementById('popup-content-list');
        contentList.innerHTML = '';
        item.content.forEach(c => {
            const div = document.createElement('div');
            div.classList.add('popup-content-item');
            div.innerHTML = `
                <img src="${c.picture || '/assets/default_item.png'}" alt="${c.name}">
                <span>${c.name || c.type}</span>
            `;
            contentList.appendChild(div);
        });

        const isOwned = item.fully_owned;
        sr.querySelector('.popup-footer').classList.toggle('hidden', isOwned);
        sr.querySelector('.popup-owned-footer').classList.toggle('hidden', !isOwned);

        if (!isOwned) {
            sr.getElementById('popup-purchase-btn').onclick = () => this.purchaseItem(item);
        }

        sr.getElementById('shop-overlay').classList.remove('hidden');
    }

    closePopup() {
        this.shadowRoot.getElementById('shop-overlay').classList.add('hidden');
    }

    async purchaseItem(item) {
        if (!accountService.isLoggedIn()) {
            window.location.replace(`${GATEWAY_URL}/pages/auth/login`);
            return;
        }
        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/shop/purchase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item, userId: accountService.getUserId() }),
            });

            if (!res.ok) {
                const result = await res.json();
                throw new Error(result.message);
            }

            const userRes = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${accountService.getUserId()}`);
            const user = await userRes.json();
            accountService.setAccount(user);

            // Notifie le parent pour qu'il mette à jour les snell coins
            this.dispatchEvent(new CustomEvent('purchase-success', { bubbles: true, composed: true }));

            this.closePopup();
            await this.render();
            notify('Item successfully Purchased', 'success');

        } catch (error) {
            console.error(error);
            notify(error.message, 'error');
        }
    }

}

customElements.define('shop-component', Shop);