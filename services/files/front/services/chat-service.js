import { GATEWAY_URL } from "../env.js";
import { authFetch } from "./account-service.js";

await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${GATEWAY_URL}/js/socket.io.js`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
});

export let socket = io(`${GATEWAY_URL}/chat`)

socket.on("connect", () => { console.log("[ChatService] Socket connected : ", socket.id) });
socket.on('connect_error', (error) => { console.error('[ChatService] Socket connection error:', error); });

export function onMessage(callback) {
    socket.on('message-chat-global', callback);
}


export async function getAllMessagesGlobal() {
    const req = await fetch(`${GATEWAY_URL}/api/chat/global`, {
        method: "GET"
    });
    if (!req.ok) { console.log("Failed to fetch messages") }
    let res = await req.json();
    return res;
}


export async function postMessageGlobal(message) {
    const req = await authFetch(`${GATEWAY_URL}/api/chat/global`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });

    if (!req.ok) {
        const error = new Error("Request failed");
        error.status = req.status;
        throw error;
    }

    let json = await req.json();
    return json;
}