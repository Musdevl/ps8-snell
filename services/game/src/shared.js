const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8000";
import { io as ioClient } from 'socket.io-client';

export const gatewayConnection = ioClient(`${GATEWAY_URL}/game`, {
    rejectUnauthorized: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});


export function formatToSend(webSocketIds, event, data) { return { webSocketIds: webSocketIds, event: event, data: data }; }
