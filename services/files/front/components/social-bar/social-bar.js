import * as accountService from "../../services/account-service.js";
import { GATEWAY_URL } from "../../env.js";
import * as userService from "../../services/user-service.js";
import * as notificationService from "../../services/notification-service.js";
// import { Toast } from '@capacitor/toast';

class SocialBar extends HTMLElement {

    friends = [];
    searchDebounceTimer = null;

    friendList = [];
    addFriendInput = "";
    searchResults = null;
    logo = null;
    username = null;
    profile_picture = null;
    profile_container = null;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
        const response = await fetch("/components/social-bar/social-bar.html");
        const content = await response.text();
        const template = new DOMParser().parseFromString(content, "text/html").querySelector("template").content;
        this.shadowRoot.appendChild(template.cloneNode(true));

        this.friendList = this.shadowRoot.querySelector("#friend-list");
        this.addFriendInput = this.shadowRoot.querySelector(".add-friend-input");
        this.searchResults = this.shadowRoot.querySelector("#user-search-results");
        this.logo = this.shadowRoot.querySelector(".logo-ico");

        this.shadowRoot.querySelector("#logout-btn").addEventListener("click", async () => {
            await accountService.logout();
            window.location.replace(`/`);
        });

        this.username = this.shadowRoot.querySelector('#username');
        this.profile_picture = this.shadowRoot.querySelector('.profile-picture');
        this.profile_container = this.shadowRoot.querySelector('#profile-container');
        this.profile_container.addEventListener("click", (e) => {
            if (e.target.closest('.snell-coin-section')) {
                return;
            }

            const username = accountService.getUserName();
            if (username) {
                window.location.replace(`${GATEWAY_URL}/pages/profile/index.html?username=${username}`);
            }
        });

        this.addFriendInput.addEventListener("input", () => {
            clearTimeout(this.searchDebounceTimer);
            const query = this.addFriendInput.value.trim();

            if (query.length === 0) {
                this.closeSearchResults();
                return;
            }

            this.searchDebounceTimer = setTimeout(() => this.searchUsers(query), 300);
        });

        document.addEventListener("click", (e) => {
            if (!this.shadowRoot.contains(e.target)) this.closeSearchResults();
        });

        this.logo.addEventListener("click", (e) => {
            window.location.replace(`/`);
        })

        this.checkLoginStatus();

        const tabFriends = this.shadowRoot.querySelector('#tab-friends');
        const tabLeaderboard = this.shadowRoot.querySelector('#tab-leaderboard');
        const friendsPanel = this.shadowRoot.querySelector('#friends-panel');
        const leaderboardPanel = this.shadowRoot.querySelector('#leaderboard-panel');

        tabFriends.addEventListener('click', () => {
            tabFriends.classList.add('active');
            tabLeaderboard.classList.remove('active');
            friendsPanel.style.display = 'block';
            leaderboardPanel.style.display = 'none';
        });

        tabLeaderboard.addEventListener('click', async () => {
            tabLeaderboard.classList.add('active');
            tabFriends.classList.remove('active');
            friendsPanel.style.display = 'none';
            leaderboardPanel.style.display = 'block';
            await this.loadLeaderboard();
        });

        await this.loadFriends();
        await this.loadFriendRequests();


        userService.onFriendRequestAccepted(async () => await this.loadFriends());
        userService.onFriendRequest(async (data) => await this.addFriendRequestCard(data.from));
        userService.onFriendRemove(async (data) => await this.loadFriends());

        this.shadowRoot.querySelector('#buy-coins-btn').addEventListener('click', async (e) => {
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
    }


    async loadLeaderboard() {
        const list = this.shadowRoot.querySelector('#leaderboard-list');
        list.innerHTML = '';

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/leaderboard`);
        const players = await res.json();
        let color = "black";

        players.forEach(player => {
            const el = document.createElement('div');
            el.className = `leaderboard-entry ${color}-bg`;

            const rankClass = player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : '';

            el.innerHTML = `
            <span class="leaderboard-rank ${rankClass}">#${player.rank}</span>
            <img class="leaderboard-avatar" src="${player.picture?.picture}" alt="${player.username}">
            <div class="leaderboard-info">
                <span class="leaderboard-username">${player.username}</span>
                <span class="leaderboard-elo">${player.elo} ELO</span>
            </div>
        `;

            el.addEventListener('click', () => {
                window.location.replace(`/pages/profile/index.html?username=${player.username}`);
            });

            list.appendChild(el);
            color = color === "black" ? "white" : "black";
        });
    }

    async searchUsers(query) {
        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/search/${encodeURIComponent(query)}`);
            const users = await res.json();

            this.searchResults.innerHTML = "";

            if (!users.length) {
                this.closeSearchResults();
                return;
            }

            const currentUserId = accountService.getUserId();
            const friendIds = this.friends.map(f => f.id.toString());

            users.forEach(user => {
                if (user.id.toString() === currentUserId) return;

                const alreadyFriend = friendIds.includes(user.id.toString());

                const el = document.createElement("div");
                el.className = "search-result-item";
                el.innerHTML = `
                    <div class="search-result-info">
                        <span class="search-result-username">${user.username}</span>
                        <span class="search-result-elo">${user.elo ?? "—"} ELO</span>
                    </div>
                    <button class="search-result-add-btn" ${alreadyFriend ? "disabled" : ""} title="${alreadyFriend ? "Already friends" : "Add friend"}">+</button>
                `;

                if (!alreadyFriend) {
                    el.querySelector(".search-result-add-btn").addEventListener("click", async () => {
                        await this.addFriend(user.id);
                        this.closeSearchResults();
                        this.addFriendInput.value = "";
                    });
                }

                this.searchResults.appendChild(el);
            });

            this.searchResults.style.display = "block";
        } catch (err) {
            console.error("Error searching users:", err);
        }
    }

    closeSearchResults() {
        this.searchResults.innerHTML = "";
        this.searchResults.style.display = "none";
    }

    updateSnellCoins() {
        this.shadowRoot.querySelector("#snell-coins").innerHTML = accountService.getSnellCoins();
    }

    async loadFriendRequests() {
        const userId = accountService.getUserId();
        if (!userId) return;

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${userId}`);
        const data = await res.json();

        (data.friendsRequests ?? []).forEach(async (fromId) => await this.addFriendRequestCard(fromId));
    }

    async addFriendRequestCard(fromId) {

        // await Toast.show({
        //     text: 'New friend request received !',
        // });

        const container = this.shadowRoot.querySelector("#friend-requests");
        if (container.querySelector(`[data-id="${fromId}"]`)) return;

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${fromId}`);
        const info = await res.json();

        container.style.display = "block";

        const el = document.createElement("div");
        el.className = "friend-request";
        el.dataset.id = fromId;
        el.innerHTML = `
            <span class="request-username">${info.username}</span>
            <div class="request-btns">
                <img src="/assets/check.svg" class="accept-btn btn"></button>
                <img src="/assets/cross.svg" class="decline-btn btn"></button>
            </div>
        `;

        this.dispatchEvent(new CustomEvent("update-notification-dot", {
            bubbles: true,
            composed: true
        }))

        el.querySelector(".accept-btn").addEventListener("click", async () => {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/friend/accept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: fromId, friendId: accountService.getUserId() })
            });

            const new_friends_requests = (await res.json()).friendsRequests;
            el.remove();
            if (!container.querySelector(".friend-request")) container.style.display = "none";

            accountService.setFriendsRequests(new_friends_requests);

            this.dispatchEvent(new CustomEvent("update-notification-dot", {
                bubbles: true,
                composed: true
            }))

            await this.loadFriends();
        });

        el.querySelector(".decline-btn").addEventListener("click", async () => {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/friend/decline`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: accountService.getUserId(), friendId: fromId })
            });

            const new_friends_requests = (await res.json()).friendsRequests;
            el.remove();

            if (!container.querySelector(".friend-request")) container.style.display = "none";

            accountService.setFriendsRequests(new_friends_requests);

            this.dispatchEvent(new CustomEvent("update-notification-dot", {
                bubbles: true,
                composed: true
            }))
        });

        container.appendChild(el);
    }

    async loadFriends() {
        const userId = accountService.getUserId();
        if (!userId) return;

        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${userId}`);
            const data = await res.json();

            if (data.friends) {
                this.friends = await Promise.all(
                    data.friends.map(async (friend) => {
                        const r = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${friend.friendId}`);
                        const info = await r.json();
                        return { id: friend.friendId, username: info.username, elo: info.elo, picture: info.picture };
                    })
                );
            }

            this.displayFriends(this.friends);
        } catch (err) {
            console.error("Failed to load friends:", err);
        }
    }

    async addFriend(friendId) {
        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/friend/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: accountService.getUserId(), friendId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            notificationService.notify("Friend Request Send");
        } catch (err) {
            notificationService.notify(`${err.message}`, "error");
        }
    }

    async removeFriend(friendId) {
        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/friend/remove`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: accountService.getUserId(), friendId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            this.friends = this.friends.filter(f => f.id !== friendId);
            this.displayFriends(this.friends);
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }


    displayFriends(friendsToDisplay) {
        this.friendList.innerHTML = "";

        if (friendsToDisplay.length === 0) {
            this.friendList.innerHTML = `<p class="no-friend-message">No friends online yet</p>`;
            return;
        }

        let color = "black";
        friendsToDisplay.forEach(friend => {
            const el = document.createElement("div");
            el.className = `friend ${color}-bg`;

            const avatarHtml = friend.picture
                ? `<img class="friend-avatar" src="${friend.picture.picture}" alt="${friend.username}">`
                : `<div class="friend-avatar friend-avatar-initiale">${friend.username[0].toUpperCase()}</div>`;

            el.innerHTML =
                `
            <div class="friend-info">
                ${avatarHtml}    
                    <span class="friend-username">${friend.username}</span>
                    <span class="friend-elo">${friend.elo ?? "—"} elo</span>
                </div>
                <div class="friend-btn-section">
                    <button class="challenge-btn">
                        <img src="/assets/challenge.svg" alt="challenge" data-id="${friend.id}">
                    </button>
                    <button class="remove-btn">
                        <img src="/assets/cross.svg" alt="remove-friend" data-id="${friend.id}">
                    </button>
                </div>
            `;

            el.querySelector(".challenge-btn").addEventListener("click", () => { this.challengeFriend(friend.id) });
            el.querySelector(".remove-btn").addEventListener("click", () => this.showConfirm(
                `Remove ${friend.username} from your friends?`,
                () => this.removeFriend(friend.id)
            ));

            el.querySelector('.friend-info').addEventListener("click", () => {
                window.location.replace(`/pages/profile/index.html?username=${friend.username}`);
            })

            this.friendList.appendChild(el);
            color = color === "black" ? "white" : "black";
        });
    }


    showConfirm(message, onConfirm) {
        const existing = this.shadowRoot.querySelector('.confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
        <div class="confirm-box">
            <p class="confirm-message">${message}</p>
            <div class="confirm-btns">
                <button class="confirm-cancel">Cancel</button>
                <button class="confirm-ok">Remove</button>
            </div>
        </div>
    `;

        modal.querySelector('.confirm-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.confirm-ok').addEventListener('click', () => {
            modal.remove();
            onConfirm();
        });

        this.shadowRoot.appendChild(modal);
    }


    checkLoginStatus() {
        const friend_list_section = this.shadowRoot.querySelector('.friend-list-section');

        const loginSection = this.shadowRoot.querySelector(".login-section");
        const logoutSection = this.shadowRoot.querySelector(".logout-section");

        if (accountService.isLoggedIn()) {
            loginSection.style.display = "none";
            logoutSection.style.display = "flex";
            this.profile_picture.src = accountService.getProfilePicture().picture;
            this.username.textContent = accountService.getUserName();
            this.shadowRoot.querySelector("#snell-coins").innerHTML = accountService.getSnellCoins();
        } else {
            loginSection.style.display = "flex";
            logoutSection.style.display = "none";
            friend_list_section.style.display = "none";
        }
    }

    async challengeFriend(friendId) {
        try {
            const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/friend/challenge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: accountService.getUserId(), friendId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            notificationService.notify("Challenge request sent", 'success')
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }

    refreshProfilePicture() {
        this.profile_picture.src = accountService.getProfilePicture().picture;
    }


}

customElements.define("social-bar", SocialBar);