import { badExpress } from '../helpers/badExpress.js';
import * as friendChatRepo from './repositories/friend-chat-repository.js';
import * as gameChatRepo from './repositories/game-chat-repository.js'
import * as globalChatRepo from './repositories/global-chat-repository.js'
import * as chatService from "../chat/chatService.js";

const app = new badExpress();
// ---------
// GAME CHAT
// ---------
// (j'ai juré c'est moi qui l'ai fait et pas l'ia la banière)

// POST /api/chat/game/{gameId}
app.post('/api/chat/game/{gameId}', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const message = req.body;

        if (chatService.isInvalidMessage(message)) {
            return res.json({ error: "Invalid Message" }, 422);
        }

        await chatService.addMessageToGameChat(gameId, message);

        res.json({ success: true });
    } catch (error) {
        console.log("[Chat API] - Error while adding a new message in game chat")
        res.json({ error: 'Error while adding a new message' }, 400);
    }
});

// GET /api/chat/game/{gameId}
app.get('/api/chat/game/{gameId}', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const chat = await gameChatRepo.getGameChat(gameId);
        res.json(chat);
    } catch (error) {
        res.json({ error: 'Error while retrieving game chat' }, 400);
    }
});


// POST /api/chat/game 
app.post('/api/chat/game', async (req, res) => {
    try {
        const gameId = req.body.gameId;
        await gameChatRepo.initGameChat(gameId);
        res.json({ success: true });
    } catch (error) {
        res.json({ error: 'Error while creating game chat' }, 400);
    }
})


// ---------
// FRIEND CHAT
// ---------
// (j'ai juré c'est moi qui l'ai fait et pas l'ia la banière)


// GET /api/chat/friend/{chatId}
app.get('/api/chat/friend/{chatId}', async (req, res) => {
    try {
        const chatId = req.params.chatId;
        const chat = await friendChatRepo.findChatById(chatId);
        if (!chat) return res.json({ error: 'Chat not found' }, 400);
        res.json(chat.messages);
    } catch (error) {
        res.json({ error: 'Error while adding a new message' }, 400);
    }
});

// POST /api/chat/friend/message
app.post('/api/chat/friend/message', async (req, res) => {
    try {
        const message = req.body;
        if (chatService.isInvalidMessage(message)) {
            return res.json({ error: "Invalid Message" }, 422);
        }

        await chatService.postFriendMessage(message);
        res.json("Message sent successfully", 200);

    } catch (error) {
        console.log("Error while sending message : ", error.message);
        res.json({ error: 'Error while sending message' }, 400);
    }
});

// POST /api/chat/friend
app.post('/api/chat/friend', async (req, res) => {
    try {
        const { user1, user2 } = req.body;
        let id = friendChatRepo.initFriendChat(user1, user2);
        res.json({ id });
    } catch (error) {
        console.log("Error while creating friend chat : ", error.message);
        res.json({ error: 'Error while creating friend chat' }, 400);
    }
});


// ---------
// GLOBAL CHAT
// ---------
// (j'ai juré c'est moi qui l'ai fait et pas l'ia la banière)


let gatewayConnection = null;
let onlineSocketId = [];


app.get("/api/chat/global", async (req, res) => {
    try {
        const messages = await globalChatRepo.getAllMessages();
        const result = messages ? messages.messages : []
        res.json({ messages: result });
    } catch (error) {
        res.json({ error: 'Error while retrieving global chat' }, 400);
        console.log(error)
    }
});

app.post("/api/chat/global", async (req, res) => {
    try {

        const message = req.body;
        if (chatService.isInvalidMessage(message)) {
            return res.json({ error: "Invalid Message" }, 422);
        }

        await chatService.postGlobalMessage(message);

        if (gatewayConnection) {
            gatewayConnection.emit("chat-ws-service", {
                event: "message-chat-global",
                webSocketIds: onlineSocketId,
                data: message
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.log("Error while sending message : ", error.message);
        res.json({ error: 'Error while sending message' }, 400);
    }
});

export function setGatewayConnection(io) {
    gatewayConnection = io;
}

export function updateOnlineIds(new_list) {
    onlineSocketId = new_list
}


// Start the server
export function startHttpServer() {
    const PORT = 8003;
    const server = app.listen(PORT, () => {
        console.log(`[CHAT_SERVICE] Server listening on port ${PORT}`);
    });

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}
