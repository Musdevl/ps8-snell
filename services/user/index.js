import * as UserApi from './API/userApi.js'
import * as UserRepo from './repositories/userRepository.js'
import * as FriendRequestRepo from './repositories/friendRequestRepository.js'
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { userId_socketId_Map, socketId_userId_Map, setIoClient } from './API/state.js';

await UserRepo.initDatabase();
await FriendRequestRepo.initDatabase();

const server = UserApi.startHttpServer();
const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8000";

const ioServer = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
    rejectUnauthorized: false,
    reconnection: true,
});

const gatewayConnection = ioClient(`${GATEWAY_URL}/user`, {
    rejectUnauthorized: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});

ioServer.on('connection', (socket) => {
    console.log(`GATEWAY Client connected: ${socket.id}`);

    socket.on('register', ({ clientId, userId }) => {
        userId_socketId_Map.set(userId, clientId);
        socketId_userId_Map.set(clientId, userId);
        console.log(`Mapped userId ${userId} <-> socketId ${clientId}`);
    });

    socket.on('disconnection', ({ clientId }) => {
        const userId = socketId_userId_Map.get(clientId);
        if (userId) {
            userId_socketId_Map.delete(userId);
            socketId_userId_Map.delete(clientId);
            console.log(`Unmapped userId ${userId} <-> socketId ${clientId}`);
        }
    });
});

setIoClient(gatewayConnection);

gatewayConnection.on('connect', () => { console.log('USER CLIENT Connected to gateway'); });