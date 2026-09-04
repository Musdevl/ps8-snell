import * as UserService from "../../services/user-service.js";
import * as accountService from "../../services/account-service.js";
import * as notificationService from "../../services/notification-service.js";
import { GATEWAY_URL } from "../../env.js";

// ─── Constants & DOM ────────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const username = params.get("username");
// Nombre de slots d'emotes affiches sur le profil. Un slot sans emote vaut
// null : la position est conservee pour pouvoir la remplir plus tard.
const EMOTE_SLOT_COUNT = 8;

const loader = document.getElementById('loader');
const profile = document.getElementById('profile');
const chat = document.querySelector('chat-component');
const achievements = document.getElementById('achievements');
const social_bar = document.querySelector('social-bar');
const nav_bar = document.querySelector('nav-bar');

let profileUserId = null;
let chatId = null;
let currentEmoteIndex = null;
let selected_profile_emotes;
let user;


// ─── Init ────────────────────────────────────────────────────────────────────
await accountService.checkAuth();
await loadProfile();
bindChatEvents();
bindInventoryModal();

// ─── Profile loading ─────────────────────────────────────────────────────────

async function loadProfile() {
    if (!username) {
        window.location.replace(`/`);
        return;
    }

    try {

        profileUserId = await fetchUserId(username);

        const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${profileUserId}`);
        user = await res.json();

        if (!res.ok) {
            window.location.replace(`/`);
            return;
        }

        chatId = user.friends.find(f => f.friendId === accountService.getUserId())?.chatId ?? null;

        setAchievements(user.achievements);

        const isOwnProfile = accountService.getUserId() === profileUserId;
        if (isOwnProfile) {
            document.querySelector('.profile-right').style.display = 'none';
        }

        await chat.readyPromise;
        chat.disableOptionButtons();

        await renderProfile();
        await renderHistory();

        document.querySelector("#mobile-logout-btn").addEventListener("click", async () => {
            await accountService.logout();
            window.location.replace(`/pages/home/play`);
        });

        if (profileUserId !== accountService.getUserId()) {


            const tabProfile = document.querySelector('#tab-profile');
            const tabChat = document.querySelector('#tab-chat');
            const profile_left = document.querySelector('.profile-left');
            const profile_right = document.querySelector('.profile-right');

            tabProfile.addEventListener('click', () => {
                tabProfile.classList.add('active');
                tabChat.classList.remove('active');
                profile_left.style.display = 'block';
                profile_right.style.display = 'none';
            });

            tabChat.addEventListener('click', async () => {
                tabChat.classList.add('active');
                tabProfile.classList.remove('active');
                profile_left.style.display = 'none';
                profile_right.style.display = 'flex';
            });

            document.querySelector('#mobile-logout-btn').style.display = "none"

        } else {
            document.querySelector('.tabs').style.display = "none";
        }


    } catch (err) {
        console.error(err);
    }
}

async function fetchUserId(username) {
    const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/getId/${username}`);
    const data = await res.json();
    if (!res.ok) throw new Error('User not found');
    return data;
}

social_bar.addEventListener("update-notification-dot", async () => {
    await nav_bar.refreshNotificationDot();
})

// ─── Render ───────────────────────────────────────────────────────────────────

async function renderProfile() {
    const wins = user.gamesWon ?? 0;
    const losses = user.gamesLost ?? 0;
    const draws = user.gamesDrawn ?? 0;
    const total = wins + losses + draws;
    const winrate = total > 0 ? `${Math.round((wins / total) * 100)}%` : '—';

    document.getElementById('avatar').src = user.picture.picture;
    document.getElementById('username').textContent = user.username;
    document.getElementById('wins').textContent = wins;
    document.getElementById('losses').textContent = losses;
    document.getElementById('draws').textContent = draws;
    document.getElementById('total').textContent = total;
    document.getElementById('winrate').textContent = winrate;
    //document.getElementById('snell-coins').textContent = user.snell_coins;


    selected_profile_emotes = normalizeEmoteSlots(accountService.getSelectedEmotes());

    await renderFriends();

    loader.classList.add('hidden');
    profile.classList.remove('hidden');

    if (chatId) await renderChat();

    if (accountService.getUserId() === profileUserId) {
        await renderInventory();
    }

    const rankRes = await accountService.authFetch(`${GATEWAY_URL}/api/user/leaderboard/${profileUserId}`);
    const rankData = await rankRes.json();

    document.getElementById('elo').textContent = `${user.elo} ELO - RANK #${rankData.rank}`;
}

async function renderFriends() {
    const friends = user.friends ?? [];
    const list = document.getElementById('friends-list');

    if (friends.length === 0) {
        list.style.cssText = 'flex-direction: row; align-items: center; justify-content: center;';
        list.innerHTML = '<span class="missing">No friends yet.</span>';
        return;
    }

    const friendsData = await Promise.all(
        friends.map(f => accountService.authFetch(`${GATEWAY_URL}/api/user/info/${f.friendId}`).then(r => r.json()))
    );

    list.innerHTML = '';

    friendsData.forEach(friend => {
        const el = document.createElement('div');
        el.className = 'friend-card';
        el.innerHTML = `
            <img src="${friend.picture.picture}" alt="${friend.username}">
            <div class="friend-card-info">
                <span class="friend-username">${friend.username}</span>
                <span class="friend-card-elo"><span>${friend.elo ?? '—'}</span> ELO</span>
            </div>
        `;
        el.addEventListener('click', () => {
            window.location.href = `/pages/profile/index.html?username=${friend.username}`;
        });
        list.appendChild(el);
    });
}

async function renderHistory() {
    const history = user.history ?? [];
    const list = document.getElementById('history');

    if (history.length === 0) {
        list.innerHTML = '<span class="missing">No games played yet.</span>';
        return;
    }

    const opponentIds = [...new Set(
        history.map(g => g.whiteId === profileUserId ? g.blackId : g.whiteId)
    )];

    const opponentMap = Object.fromEntries(
        await Promise.all(
            opponentIds.map(async id => {
                try {
                    const res = await accountService.authFetch(`${GATEWAY_URL}/api/user/info/${id}`);
                    const info = await res.json();
                    return [id, info.username ?? id];
                } catch {
                    return [id, id];
                }
            })
        )
    );

    list.innerHTML = '';

    history.forEach(game => {
        const isWhite = game.whiteId === profileUserId;
        const opponentId = isWhite ? game.blackId : game.whiteId;
        const isDraw = game.winnerId === 'DRAW';
        const won = game.winnerId === profileUserId;
        const resultClass = isDraw ? 'draw' : (won ? 'win' : 'loss');

        const el = document.createElement('div');
        el.className = `game-card ${resultClass}`;
        el.innerHTML = `
            <span class="game-players">
                <span class="me">${username}</span>
                <span class="sep">vs</span>
                ${opponentMap[opponentId] ?? opponentId}
            </span>
        `;
        el.addEventListener('click', () => {
            window.location.href = `/pages/game/review/${game.gameId}`;
        });
        list.appendChild(el);
    });
}

async function renderInventory() {
    document.querySelector('.inventory-section').style.display = 'flex';
    renderProfilePictures();
    renderThemes();
    renderSelectedEmotes();
    renderEmotes();
}

function renderProfilePictures() {
    try {
        const profile_pictures = document.querySelector('#profile-picture-list');

        loadPictureList(profile_pictures, accountService.getProfilePictureList(), 'profile-picture-item',

            async (item) => { await updateProfilePicture(item); },

            (profile_picture_id, img) => {
                if (accountService.getProfilePicture().id === profile_picture_id) {
                    img.classList.add('selected');
                }
            });
    } catch (error) {
        console.log("[Profile]", error);
    }

}

function renderThemes() {
    try {
        const themeList = document.querySelector('#theme-list');

        loadPictureList(themeList, accountService.getThemes(), "theme-item",

            async (theme) => { await updateSelectedTheme(theme); },

            (theme_id, theme) => {
                if (accountService.getTheme().id === theme_id) {
                    theme.classList.add('selected');
                }
            })
    } catch (error) {
        console.log("[Profile]", error);
    }

}

function isEmote(emote) {
    return !!emote && typeof emote.picture === 'string';
}

// Ramene la liste sauvegardee a EMOTE_SLOT_COUNT slots, les entrees invalides
// (null, undefined, objet sans picture) devenant des slots vides.
function normalizeEmoteSlots(emotes) {
    const slots = Array.isArray(emotes) ? emotes.slice(0, EMOTE_SLOT_COUNT) : [];
    while (slots.length < EMOTE_SLOT_COUNT) slots.push(null);
    return slots.map(emote => isEmote(emote) ? emote : null);
}

function renderSelectedEmotes() {
    const selectedEmoteList = document.querySelector('.selected-emote-list');
    selectedEmoteList.innerHTML = '';

    selected_profile_emotes.forEach((emote, index) => {
        const slot = document.createElement('div');
        slot.className = 'selected-emote-slot';

        if (isEmote(emote)) {
            const img = document.createElement('img');
            img.src = emote.picture;
            img.alt = emote.name ?? 'emote';
            img.className = 'selected-emote-item selected-inventory-item';
            slot.appendChild(img);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'remove-emote-btn';
            remove.title = 'Empty this slot';
            remove.textContent = '\u00d7';
            remove.addEventListener('click', async (e) => {
                e.stopPropagation();
                selected_profile_emotes[index] = null;
                await updateSelectedEmotes();
            });
            slot.appendChild(remove);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'empty-emote-slot selected-inventory-item';
            placeholder.textContent = '+';
            placeholder.title = 'Empty slot';
            slot.appendChild(placeholder);
        }

        slot.addEventListener('click', () => {
            currentEmoteIndex = index;
            showInventoryModal();
        });

        selectedEmoteList.appendChild(slot);
    });
}

function renderEmotes() {
    try {
        const emoteList = document.querySelector('#emote-list');

        loadPictureList(emoteList, accountService.getEmotes(), 'emote-item', async (newEmote) => {
            if (currentEmoteIndex !== null) {
                selected_profile_emotes[currentEmoteIndex] = newEmote;

                await updateSelectedEmotes();

                closeInventoryModal();
                currentEmoteIndex = null; // Reset
            }
        });
    } catch (error) {
        console.log("[Profile]", error);
    }

}


async function updateProfilePicture(profile_picture) {

    try {
        if (profile_picture.id !== accountService.getProfilePicture().id) {
            const result = await accountService.authFetch(`${GATEWAY_URL}/api/user/profile-picture`, {
                method: "PUT",
                body: JSON.stringify({
                    profile_picture: profile_picture,
                    userId: accountService.getUserId()
                }),
                headers: { "Content-Type": "application/json" }
            })

            if (!result.ok) {
                notificationService.notify("Failed to save profile picture", "error");
            }

            accountService.setProfilePicture(profile_picture);
            document.getElementById('avatar').src = profile_picture.picture;
            social_bar.refreshProfilePicture();
            nav_bar.refreshProfilePicture();
            notificationService.notify("Profile picture saved successfully", "success");
            renderProfilePictures();
        }
    } catch (error) {
        notificationService.notify("Failed to save profile picture", "error");
    }

}


async function updateSelectedTheme(theme) {
    try {
        if (theme.id !== accountService.getTheme().id) {
            const result = await accountService.authFetch(`${GATEWAY_URL}/api/user/selected-theme`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId: accountService.getUserId(),
                    selected_theme: theme
                }),
            })

            if (!result.ok) {
                notificationService.notify("Failed to save theme", "error");
            }

            accountService.setTheme(theme);
            notificationService.notify("Theme saved successfully", "success");
            renderThemes();
        }
    } catch (error) {
        notificationService.notify("Failed to save theme", "error");
    }
}

async function updateSelectedEmotes() {
    try {

        const result = await accountService.authFetch(`${GATEWAY_URL}/api/user/selected-emotes`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                userId: accountService.getUserId(),
                selected_emotes: selected_profile_emotes
            }),

        })

        if (!result.ok) {
            notificationService.notify("Failed to save emotes", "error");
        }
        accountService.setSelectedEmotes(selected_profile_emotes);
        renderSelectedEmotes();
        notificationService.notify("Selected emotes saved successfuly", "success")
    } catch (error) {
        console.log("[Profile]", error);
        notificationService.notify("Failed to save emotes", "error");
    }
}


async function renderChat() {
    try {
        await customElements.whenDefined('chat-component');
        chat.disableDrawButton();
        chat.disableForfeitButton();
        const messages = await UserService.fetchFriendChat(chatId);
        chat.setChat(messages);
    } catch (error) {
        console.log("[Profile]", error);
    }

}

// ─── Inventory ────────────────────────────────────────────────────────────────

function loadPictureList(container, items, className, onClick = null, applyOnAll = null) {
    container.innerHTML = '';
    items.forEach(item => {
        const img = document.createElement('img');
        img.src = item.picture;
        img.alt = className.split(' ')[0];
        img.className = className;
        if (onClick) img.addEventListener('click', () => onClick(item));
        if (applyOnAll) applyOnAll(item.id, img);
        container.appendChild(img);
    });
}

function showInventoryModal() {
    document.querySelector('#inventory-modal').classList.add('active');
}

function closeInventoryModal() {
    document.querySelector('#inventory-modal').classList.remove('active');
}

// ─── Achievements ─────────────────────────────────────────────────────────────

function setAchievements(list) {

    if (list.length === 0) {
        achievements.innerHTML = '<span class="empty-list">No achievements have been unlocked yet.</span>';
        return;
    }

    list.forEach(({ picture, name, reward, description, isCompleted }) => {

        const completed_class = isCompleted ? "" : " not-completed"

        achievements.innerHTML += `
            <div class="achievement-item${completed_class}">
                <img class="achievement-picture" src="${GATEWAY_URL}${picture}" alt="${name}">
                <div class="achievement-right-side">
                    <div class="achievement-item-header">
                        <span class="achievement-text">${name}</span>
                        <div class="reward-achievement-section">
                        +${reward.snell_coins}<img src="/assets/snell-coin.png">
                        </div>
                    </div>
                    <span class="achievement-description">
                        ${description}
                    </span>
                </div>
            </div>
        `;
    });
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindChatEvents() {
    chat.addEventListener('send-message', async (e) => {
        e.detail.message.userId = accountService.getUserId();
        e.detail.message.chatId = chatId;
        try {
            const req = await accountService.authFetch(`${GATEWAY_URL}/api/chat/friend/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(e.detail.message)
            });


            if (!req.ok) {
                const error = new Error('HTTP Error');
                error.status = req.status;
                throw error;
            }

            await req.json();

        } catch (error) {
            if (error.status === 422) {
                chat.show_invalid_message();
            } else {
                notificationService.notify("Failed to send the message", "error");
            }
        }
    });

    UserService.getSocketConnection().on('friend-message', (data) => {
        chat.addNewMessage(data);
    });
}

function bindInventoryModal() {
    document.querySelector('#inventory-modal').addEventListener('click', (e) => {
        closeInventoryModal();
    });
}