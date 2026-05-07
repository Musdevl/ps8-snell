export let onlineSocketId = []

export function removeSocketId(id) {
    onlineSocketId = onlineSocketId.filter(socketId => socketId !== id);
}

export function addSocketId(id) {
    onlineSocketId.push(id);
}