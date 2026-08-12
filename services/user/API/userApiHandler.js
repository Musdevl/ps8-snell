import * as userRepo from "../repositories/userRepository.js";
import * as friendRequestRepo from "../repositories/friendRequestRepository.js";
import { env } from "../../helpers/env.js";
import { userId_socketId_Map, ioClient } from './state.js';
import jwt from 'jsonwebtoken';
import bcrypt from "bcrypt";
import crypto from "crypto";
import { default_theme, default_profile_picture, default_emotes, ppList } from "./default_values.js";


const GAME_SERVICE_URL = process.env.GAME_SERVICE_URL || "http://localhost:8002";
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:8003';
const ACHIEVEMENT_SERVICE_URL = process.env.ACHIEVEMENT_SERVICE_URL || 'http://localhost:8004';
const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || 'http://localhost:8006';

const saltRounds = 10;

// Durée de validité d'un lien de réinitialisation.
const RESET_TOKEN_DURATION = 60 * 60 * 1000; // 1 heure

export async function createUser(email, username, password) {
    const alreadyTaken = await userRepo.areUserInformationsValid(email, username);

    if (alreadyTaken) throw new Error("User informations already taken");

    const hashed_password = await bcrypt.hash(password, saltRounds);

    const achievement_request = await fetch(`${ACHIEVEMENT_SERVICE_URL}/api/achievements/blank`);

    const content = await achievement_request.json();


    await userRepo.saveUser({
        email,
        username,
        password: hashed_password,
        friends: [],
        picture: default_profile_picture,
        profile_picture_list: ppList,
        gamesWon: 0,
        gamesLost: 0,
        gamesDrawn: 0,
        elo: 1000,
        emotes: [...default_emotes],
        selected_emotes: [...default_emotes],
        game_history: [],
        achievements: JSON.parse(content).achievements,
        selected_theme: default_theme,
        themes: [default_theme],
        snell_coins: 2500
    });

    sendWelcomeMail(email, username);
}

// Volontairement pas attendu : un service mail indisponible ne doit pas faire
// échouer une inscription par ailleurs réussie.
function sendWelcomeMail(email, username) {
    fetch(`${MAIL_SERVICE_URL}/api/mail/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, username })
    }).catch(error => console.log("[USER] - Mail de bienvenue non envoyé :", error.message));
}


export async function getUserFriendRequests(userId) {
    return await friendRequestRepo.getFriendRequests(userId);
}

// ── Mot de passe oublié ──────────────────────────────────────────────────────

// On ne stocke que l'empreinte du token : le token en clair ne vit que dans le
// lien envoyé par mail.
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Envoie le lien de réinitialisation.
 * `origin` est l'adresse par laquelle le navigateur a joint le site, pour que le
 * lien reste valable quel que soit le serveur qui héberge le jeu.
 */
export async function requestPasswordReset(email, origin) {
    const user = await userRepo.getUserByEmail(email);

    // Silence volontaire si l'adresse est inconnue : répondre différemment
    // permettrait de savoir quelles adresses sont inscrites.
    if (!user) {
        console.log("[USER] - Demande de reset pour une adresse inconnue, aucun mail envoyé");
        return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION);

    await userRepo.saveResetToken(user._id, hashToken(token), expiresAt);

    const link = `${origin}/pages/auth/reset-password/index.html?token=${token}`;

    const res = await fetch(`${MAIL_SERVICE_URL}/api/mail/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, username: user.username, link })
    });

    if (!res.ok) throw new Error("Le service mail n'a pas pu envoyer le lien");
}

export async function resetPassword(token, newPassword) {
    if (!token || !newPassword) throw new Error("Lien ou mot de passe manquant");

    const user = await userRepo.findByResetToken(hashToken(token));

    if (!user) throw new Error("Lien invalide");
    if (user.reset_token_expires < new Date()) throw new Error("Lien expiré");

    const hashed_password = await bcrypt.hash(newPassword, saltRounds);

    // Le token est effacé au passage : un lien ne sert qu'une fois.
    await userRepo.setPasswordAndClearToken(user._id, hashed_password);
}


export async function hardResetPassword(email, newPassword) {
    const user = await userRepo.getUserByEmail(email);
    if (!user) throw new Error("User not found");
    const hashed_password = await bcrypt.hash(newPassword, saltRounds);
    await userRepo.saveUser({ ...user, password: hashed_password });
}
export async function addGameHistory(userId, game_history) {
    if (game_history.winnerId === "DRAW") {

        await userRepo.incrementDraw(userId);
    }
    else if (game_history.winnerId === userId) {
        await userRepo.incrementWin(userId);
    }
    else {
        await userRepo.incrementLoss(userId);
    }
    await userRepo.pushInHistory(userId, game_history);
}

export async function requestFriend(userId, friendId) {
    if (userId === friendId) throw new Error("Cannot add yourself as friend");

    const user = await userRepo.findUserById(userId);
    const friend = await userRepo.findUserById(friendId);

    if (user.friends.some(id => id.toString() === friendId.toString())) throw new Error("Already friends");
    if (friend.friends.some(id => id.toString() === userId.toString())) throw new Error("Already friends");

    await friendRequestRepo.createFriendRequest(userId, friendId);

    // Notifier si le destinataire est en ligne
    const friendSocketId = userId_socketId_Map.get(friendId.toString());
    if (friendSocketId && ioClient) {
        ioClient.emit('user-ws-service', { webSocketIds: friendSocketId, event: 'friend-request', data: { from: userId } });
        console.log(`Notification envoyée à ${friendId} (socket: ${friendSocketId})`);
    } else {
        console.log("Amis hors ligne pas de WS");
    }
}

export async function forwardMessage(userIds, message) {

    if (userIds.user1 === userIds.user2) throw new Error("Cannot message yourself");

    const user = await userRepo.findUserById(userIds.user1);
    const friend = await userRepo.findUserById(userIds.user2);

    let from = message.userId === userIds.user1 ? user : friend;

    const friendSocketId = userId_socketId_Map.get(userIds.user2.toString());
    const userSocketId = userId_socketId_Map.get(userIds.user1.toString());

    message.picture = from.picture.picture;
    message.username = from.username;

    if (friendSocketId && ioClient) {
        ioClient.emit('user-ws-service', { webSocketIds: [userSocketId, friendSocketId], event: 'friend-message', data: message });
        console.log(`Notification envoyée à ${userIds.user2} (socket: ${friendSocketId})`);
        console.log(`Notification envoyée à ${userIds.user1} (socket: ${userSocketId})`);
    } else {
        console.log("Amis hors ligne pas de WS");
    }

    return message;
}

export async function requestChallenge(userId, friendId) {

    if (userId === friendId) throw new Error("Cannot challenge yourself");
    const user = await userRepo.findUserById(userId);
    // Notifier si le destinataire est en ligne
    const friendSocketId = userId_socketId_Map.get(friendId.toString());

    if (friendSocketId && ioClient) {
        ioClient.emit('user-ws-service', { webSocketIds: friendSocketId, event: 'challenge-request', data: { from: { username: user.username, userId: userId } } });
        console.log(`Notification envoyée à ${friendId} (socket: ${friendSocketId})`);
    } else {
        console.log("Amis hors ligne pas de WS");
    }
}

export async function acceptChallenge(userId, friendId) {
    if (userId === friendId) throw new Error("Cannot challenge yourself");

    const userSocketId = userId_socketId_Map.get(userId.toString());
    const friendSocketId = userId_socketId_Map.get(friendId.toString());

    const res = await fetch(`${GAME_SERVICE_URL}/api/game`, {
        method: 'POST',
        body: JSON.stringify({
            gameType: "MULTI",
            players: [userId, friendId]
        })
    })

    if (userSocketId && friendSocketId && ioClient) {
        ioClient.emit('user-ws-service', { webSocketIds: [userSocketId, friendSocketId], event: 'challenge-accepted' })
    }

}

export async function acceptFriendRequest(userId, friendId) {
    await friendRequestRepo.findFriendRequest(userId, friendId);
    await userRepo.addFriend(userId, friendId);
    await friendRequestRepo.deleteRequest(userId, friendId);

    const senderSocketId = userId_socketId_Map.get(userId.toString());
    if (senderSocketId && ioClient) {
        ioClient.emit('user-ws-service', { webSocketIds: senderSocketId, event: 'friend-request-accepted', data: { from: friendId } });
        console.log(`Notification d'acceptation envoyée à ${userId} (socket: ${senderSocketId})`);
    }
}

export async function addElo(userId, elo) {

    let user = await userRepo.findUserById(userId);

    await userRepo.setElo(userId, elo + user.elo);

}

export async function declineFriendRequest(userId, friendId) {
    await friendRequestRepo.findFriendRequest(userId, friendId); // throw si inexistante
    await friendRequestRepo.deleteRequest(userId, friendId);
}

export async function removeFriend(userId, friendId) {
    await userRepo.removeFriend(userId, friendId);

    let friendSocketId = userId_socketId_Map.get(friendId.toString());

    if (friendSocketId && ioClient) {
        ioClient.emit('user-ws-service', { webSocketIds: friendSocketId, event: 'friend-removed', data: { from: userId } });
        console.log("Notification de suppression d'amis envoyée")
    }
}


export async function findUser(email, password) {

    let user = await userRepo.getUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Invalid credentials");
    user.friendsRequests = await friendRequestRepo.getFriendRequests(user._id.toString());
    return user;
}

export function createToken(id, key, expiration) {
    return jwt.sign({ id: id }, key, { expiresIn: expiration });
}


export async function getUserInformation(userId) {
    const user = await userRepo.findUserById(userId);
    const friendRequest = await friendRequestRepo.getFriendRequests(userId);
    const result = {
        _id: user._id,
        username: user.username,
        elo: user.elo,
        picture: user.picture,
        gamesWon: user.gamesWon,
        gamesLost: user.gamesLost,
        gamesDrawn: user.gamesDrawn,
        friends: user.friends,
        friendsRequests: (friendRequest ?? []).map(fr => fr.userId),
        history: user.game_history,
        achievements: user.achievements,
        emotes: user.emotes,
        selected_emotes: user.selected_emotes,
        profile_picture_list: user.profile_picture_list,
        selected_theme: user.selected_theme,
        themes: user.themes,
        snell_coins: user.snell_coins,
    };

    return result;
}

export async function postMessage(message) {

    const user = await userRepo.findUserById(message.userId)

    message.username = user.username;
    message.picture = user.picture;

    const result = await fetch(CHAT_SERVICE_URL + "/api/chat/friend/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    });

    const body = await result.json();

    const users = body.users;
    const newMessage = body.message;

    [users.user1, users.user2].forEach(userId => {
        const socketId = userId_socketId_Map.get(userId.toString());
        if (socketId) {
            ioClient.emit('user-ws-service', { webSocketIds: socketId, event: 'friend-message', data: newMessage });
        }
    });

    return { newMessage, users };
}


export async function searchUsers(users) {
    return userRepo.searchUsersByUsername(users);
}

export async function getUserIdFromUsername(username) {
    const user = await userRepo.findUserByUsername(username);
    if (!user) throw new Error("User not found");
    return user._id;
}

export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, env.jwt_key);
        return decoded.id;
    } catch {
        throw new Error("Invalid or expired token");
    }
}

export async function completeAchievement(userId, achievement) {
    if (await userRepo.completeAchievement(userId, achievement)) {
        const user_socket_id = userId_socketId_Map.get(userId);
        ioClient.emit("user-ws-service", { webSocketIds: user_socket_id, event: "achievement-completed", data: achievement });
    }

}

export async function updateSelectedEmotes(selected_emotes, userId) {
    await userRepo.updateSelectedEmotes(userId, selected_emotes);
}


export async function updateProfilePicture(userId, picture) {
    await userRepo.updateProfilePicture(userId, picture);
}

export async function updateSelectedTheme(userId, selected_theme) {
    await userRepo.updateSelectedTheme(userId, selected_theme);
}

export async function addItem(userId, item) {
    for (const element of item.content) {
        switch (element.type) {
            case "emote":
                await addEmoteToInventory(userId, element);
                break;
            case "profile-picture":
                await addProfilePicture(userId, element);
                break;
            case "theme":
                await addTheme(userId, element);
                break;
        }
    }
}

export async function addEmoteToInventory(userId, emote) {
    await userRepo.addEmoteToInventory(userId, emote);
}

export async function addProfilePicture(userId, profile_picture) {
    await userRepo.addProfilePicture(userId, profile_picture);
}

export async function addTheme(userId, theme) {
    await userRepo.addTheme(userId, theme);
}

export async function addSnellCoin(userId, amount) {
    await userRepo.addSnellCoins(userId, amount);
}

export async function getLeaderboard() {
    return await userRepo.getLeaderboard();
}

export async function getUserRank(userId) {
    return await userRepo.getUserRank(userId);
}