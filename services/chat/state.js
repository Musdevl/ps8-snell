export let onlineSocketId = []

// socketId -> { userId, username, picture }
export const typingUsers = new Map();

export function removeSocketId(id) {
    onlineSocketId = onlineSocketId.filter(socketId => socketId !== id);
}

export function addSocketId(id) {
    onlineSocketId.push(id);
}

export function setTyping(socketId, user) {
    typingUsers.set(socketId, user);
}

export function clearTyping(socketId) {
    return typingUsers.delete(socketId);
}

// Un meme user ouvert sur plusieurs onglets ne doit apparaitre qu'une fois.
export function getTypingUsers() {
    const seen = new Set();
    const users = [];
    for (const user of typingUsers.values()) {
        if (seen.has(user.userId)) continue;
        seen.add(user.userId);
        users.push(user);
    }
    return users;
}
