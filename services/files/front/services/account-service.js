import { GATEWAY_URL } from "../env.js";
import { notify } from "./notification-service.js";

const STORAGE_KEY = 'user_account';
const TOKEN_KEY = 'jwt_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
}

function saveToStorage(account) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

let accountData;

// ── Token helpers ────────────────────────────────────────────────────────────

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(jwt_token, jwt_refresh_token) {
    console.log("setting new tokens", jwt_token, jwt_refresh_token);
    if (jwt_token) localStorage.setItem(TOKEN_KEY, jwt_token);
    if (jwt_refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, jwt_refresh_token);
}

export function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}


export async function authFetch(url, options = {}) {
    const token = getToken();
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {})
        }
    });

    // Mettre à jour le token si la gateway en a généré un nouveau
    const newToken = res.headers.get('X-New-Token');
    if (newToken) {
        setTokens(newToken, null);
    }

    return res;
}

// ── Account helpers ──────────────────────────────────────────────────────────

export function setUsername(newUsername) {
    if (newUsername) {
        accountData.username = newUsername;
        saveToStorage(accountData);
        console.log("[Account Service] - User Name successfully changed");
    }
}

export function setAccount(account) {
    console.log("[Account Service] - Setting a new account");
    if (account) {
        accountData.userId = account._id;
        accountData.username = account.username;
        accountData.elo = account.elo;
        accountData.emotes = account.emotes;
        accountData.profile_picture = account.picture;
        accountData.profile_picture_list = account.profile_picture_list;
        accountData.selected_emotes = account.selected_emotes;
        accountData.selected_theme = account.selected_theme;
        accountData.themes = account.themes;
        accountData.snell_coins = account.snell_coins;
        accountData.emotes = account.emotes;
        accountData.friends_requests = account.friendsRequests;

        saveToStorage(accountData);

        console.log("[Account Service] - Account saved");
    } else {
        console.log("[Account Service] - Invalid User Account");
    }
}

export async function getFriendsRequests() {
    if (isLoggedIn()) {
        try {
            let res = await authFetch(`${GATEWAY_URL}/api/user/friend-requests`, {
                method: "POST",
                body: JSON.stringify({
                    userId: getUserId()
                })
            });

            if (!res.ok) {
                notify("Failed to retrieve friends requests", "error");
                throw new Error("Failed to retrieve friends requests");
            }

            const result = await res.json();

            accountData.friends_requests = result;
            saveToStorage(accountData);

            return result
        } catch (error) {
            console.log(error);
        }
    } else {
        return [];
    }
}

export function setFriendsRequests(friends_requests) {
    accountData.friends_requests = friends_requests;
    saveToStorage(accountData);
}

export function setSelectedEmotes(selected_emotes) {
    accountData.selected_emotes = selected_emotes;
    saveToStorage(accountData);
}

export function setTheme(theme) {
    accountData.selected_theme = theme;
    saveToStorage(accountData);
}

export function getTheme() {
    return accountData.selected_theme;
}

export function getUserId() {
    return accountData.userId;
}

export function getProfilePicture() {
    return accountData.profile_picture;
}

export function getProfilePictureList() {
    return accountData.profile_picture_list;
}

export function getUserName() {
    return accountData.username;
}

export function getElo() {
    return accountData.elo;
}

export function getSelectedEmotes() {
    return accountData.selected_emotes;
}

export function getEmotes() {
    return accountData.emotes;
}

export function decrementSnellCoins(snell_coins) {
    accountData.snell_coins -= snell_coins;
    saveToStorage(accountData);
}

export function resetAccount() {
    accountData = {
        userId: null,
        username: null,
        elo: null
    };
    clearTokens();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.clear();

    console.log("[Account Service] - Account reset");
}

export function setProfilePicture(picture) {
    accountData.profile_picture = picture;
    saveToStorage(accountData);
}

export function getThemes() {
    return accountData.themes;
}

export async function logout() {
    accountData = {
        userId: null,
        username: null,
        elo: null
    };

    clearTokens();
    localStorage.clear();

    await authFetch(`${GATEWAY_URL}/api/user/logout`, {
        method: 'POST',
    });

    window.location.replace('/');
}

export async function login(email, password) {
    const res = await fetch(`${GATEWAY_URL}/api/user/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-type": "application/json; charset=UTF-8" }
    });

    switch (res.status) {
        case 200:
            const data = await res.json();
            setTokens(data.jwt_token, data.jwt_refresh_token);
            setAccount(data.user);
            window.location.replace(`/`);
            break;
        case 400:
            console.log("Invalid Credentials");
            notify("Invalid Credentials", 'error');
            break;
        case 404:
            console.log("Unknown route");
            break;
        default:
            console.log("Something went wrong :(");
    }
}

export async function register(email, username, password) {
    if (email, username, password) {
        const res = await fetch(`${GATEWAY_URL}/api/user/register`, {
            method: "POST",
            body: JSON.stringify({ email, username, password }),
            headers: { "Content-type": "application/json; charset=UTF-8" }
        });

        switch (res.status) {
            case 200:
                const data = await res.json();
                console.log(data)
                setTokens(data.jwt_token, data.jwt_refresh_token);
                setAccount(data.user);
                return data.user;
            case 400:
                console.log("[Register] - Something went wrong");
                let body = await res.json();
                notify(body.message, 'error');
                break;
            default:
                notify("Unkown Error", 'error');
                console.log("[Register] - Unknown Error");
        }
    } else {
        notify("Invalid Fields", "error");
    }
}

function init() {
    accountData = loadFromStorage() || {
        userId: null,
        username: null,
        elo: null
    };
}

export function isLoggedIn() {
    return !!accountData.userId;
}

// Demande l'envoi du lien de réinitialisation. La réponse est volontairement la
// même que l'adresse existe ou non.
export async function requestPasswordReset(email) {
    const res = await fetch(`${GATEWAY_URL}/api/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    if (res.status === 200) {
        notify("If an account exists for this address, an email has been sent", 'success');
        return true;
    }

    notify("Could not send the email", 'error');
    return false;
}

// Applique le nouveau mot de passe à partir du token reçu par mail.
export async function resetPassword(token, new_password) {
    const res = await fetch(`${GATEWAY_URL}/api/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password })
    });

    const data = await res.json();

    if (res.status === 200) {
        notify("Password reset successfully", 'success');
        return true;
    }

    notify(data.message || "This link is invalid or has expired", 'error');
    return false;
}

export async function hardResetPassword(email, new_password) {
    const res = await fetch(`${GATEWAY_URL}/api/user/hard-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password })
    });

    const data = await res.json();

    switch (res.status) {
        case 200:
            notify("Password reset successfully", 'success');
            setTimeout(async () => await login(email, new_password), 800);
            break;
        case 400:
            notify(data.message, 'error');
            break;
        default:
            notify("Unknown error", 'error');
    }
}

export function getSnellCoins() {
    return accountData.snell_coins;
}

export function applyReward(reward) {
    if (reward.snell_coins) {
        accountData.snell_coins += reward.snell_coins;
        saveToStorage(accountData);
    }
}

export async function checkAuth() {
    const jwt_token = localStorage.getItem('jwt_token');
    try {
        const res = await authFetch(`${GATEWAY_URL}/api/user/verify`);
        if (!res.ok) {
            window.location.replace('/pages/auth/login/index.html');
        }
    } catch (e) {
        window.location.replace('/pages/auth/login/index.html');
    }
}

init();