import { GATEWAY_URL } from "../env.js";
import * as accountService from "./account-service.js";
import { notify } from "./notification-service.js";

await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${GATEWAY_URL}/js/socket.io.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
});

export let socket = io(`${GATEWAY_URL}/user`);

socket.on('connect', () => { console.log('[UserService] Socket connected:', socket.id); });
socket.on('connect_error', (error) => { console.error('[UserService] Socket connection error:', error); });

if (accountService.getUserId()) {
    socket.emit('register', { userId: accountService.getUserId(), clientId: socket.id });
}

socket.on('friend-request', (data) => {
    notify('You received a friend request!', 'info');
});

socket.on('friend-request-accepted', (data) => {
    notify('Your friend request was accepted!', 'success');
});

socket.on('challenge-request', (data) => {
    notify(`You received a challenge request from ${data.from.username}`, 'challenge', data, 100000);
})

socket.on('challenge-accepted', () => {
    notify(`Challenge accepted !`, 'info');
    setTimeout(() => window.location.replace(`/pages/game/multiplayer-game/index.html`), 750)
})

socket.on('achievement-completed', (data) => {
    accountService.applyReward(data.reward);
    notify(`New achievement completed - ${data.name}`, 'achievement', data, 5000)
})

export function getSocketConnection() { return socket; }

export function onFriendRequest(callback) {
    socket.on('friend-request', callback);
}

export function onFriendRemove(callback) {
    socket.on('friend-removed', callback);
    console.log("Remove friend WS received")
}

export function onFriendRequestAccepted(callback) {
    socket.on('friend-request-accepted', callback);
}

export async function fetchFriendChat(chatId) {
    const res = await accountService.authFetch(`${GATEWAY_URL}/api/chat/friend/${chatId}`, {
        method: "GET"
    });
    const json = await res.json();
    console.log("DEBUG : Get chat friend : " + json)
    return json;
}