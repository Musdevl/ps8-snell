import * as chatApi from './chatApi.js'
import * as gameChatRepo from './repositories/game-chat-repository.js'
import * as friendChatRepo from './repositories/friend-chat-repository.js'
import * as globalChatRepo from './repositories/global-chat-repository.js'
import * as State from './state.js';

import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';


const server = chatApi.startHttpServer();
const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8000";


const ioServer = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
    rejectUnauthorized: false,
    reconnection: true,
});

const gatewayConnection = ioClient(`${GATEWAY_URL}/chat`, {
    rejectUnauthorized: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});



ioServer.on('connection', (socket) => {

    console.log(`GATEWAY Client connected: ${socket.id}`);


    socket.on("register", ({socketId}) => {
        console.log(`User register to chat service: ${socket.id}`);
        State.addSocketId(socketId);
        chatApi.updateOnlineIds(State.onlineSocketId);
    });

    socket.on("disconnection", ({socketId}) =>{
        console.log(`User disconnect from chat service : ${socket.id}`);
        State.removeSocketId(socketId);
        chatApi.updateOnlineIds(State.onlineSocketId);
    })

    socket.on("disconnect", () => {
    });
});


chatApi.setGatewayConnection(gatewayConnection);

gatewayConnection.on('connect', () => { console.log('USER CLIENT Connected to gateway'); });
process.on('SIGTERM', async() => {
    await closeRepo();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await closeRepo();
    process.exit(0);
});


await gameChatRepo.initDatabase();
await friendChatRepo.initDatabase();
await globalChatRepo.initDatabase();

async function closeRepo(){
    await gameChatRepo.closeDatabase();
    await friendChatRepo.closeDatabase();
    await globalChatRepo.closeDatabase();
}