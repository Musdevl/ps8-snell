const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const fs = require('fs');
const { middleware: auth_middleware } = require('./auth-middleware.js');

const ENV = process.env.ENV || "dev";
const PORT = 8000;

const URLS = {
    user: process.env.USER_SERVICE_URL || 'http://localhost:8010',
    files: process.env.FILE_SERVICE_URL || "http://localhost:8001",
    game: process.env.GAME_SERVICE_URL || "http://localhost:8002",
    chat: process.env.CHAT_SERVICE_URL || "http://localhost:8003",
    ai: process.env.AI_SERVICE_URL || "http://localhost:8020",
    shop: process.env.SHOP_SERVICE_URL || "http://localhost:8005",
};

const proxy = httpProxy.createProxyServer();

const gameClient = ioClient(URLS.game, { reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5 });
gameClient.on('connect', () => console.log('[GATEWAY-GAME] - Game Service connected'));

const userClient = ioClient(URLS.user, { reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5 });
userClient.on('connect', () => console.log('[GATEWAY-USER] - User connected'));

const chatClient = ioClient(URLS.chat, { reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5 });
chatClient.on('connect', () => console.log("[GATEWAY-CHAT] - Chat connected"));

const PUBLIC_ROUTES = [
    '/pages/auth/',
    '/api/user/login',
    '/api/user/register',
    '/api/user/verify',
    '/api/user/forgot-password',
    '/api/user/reset-password',
    '/api/user/hard-reset-password',
    '/api/chat/global',
    '/api/shop',
    '/assets/',
    '/pages/home/',
    '/services/',
    '/js/',
    '/pages/shop/success',

    '/pages/game/local-game',
    '/pages/game/tutorial',
    '/api/game/tutorial',
    '/pages/game/shared',
    '/components/',
    '/enum/',

    '/utils/',

    '/env.js'
];

const BLACK_LIST_ROUTES = [
    '/api/user/set-elo',
];

const requestHandler = (req, res) => {

    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Refresh-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
    }

    try {
        const isPublic = PUBLIC_ROUTES.some(route => req.url.startsWith(route)) || req.url == "/";

        if (!isPublic) {
            const verified = auth_middleware.verifyToken(
                req.headers.cookie,
                req.headers.authorization,
                req.headers['x-refresh-token']
            );

            if (!verified) {
                res.statusCode = 302;
                res.setHeader('Location', '/pages/auth/login');
                return res.end();
            }

            if (verified.isNew) {
                console.log("[AUTH MIDDLEWARE] - New Token !");
                res.setHeader('Set-Cookie', `jwt_token=${verified.token}; HttpOnly; Path=/`);
                res.setHeader('X-New-Token', verified.token);
            }
        }

        const parts = req.url.split("/").filter(e => e !== "..");

        if (BLACK_LIST_ROUTES.some(route => req.url.includes(route))) {
            res.statusCode = 403;
            return res.end("Forbidden");
        }

        switch (parts[1]) {
            case "api":
                if (parts[2] === "status") {
                    res.statusCode = 200;
                    return res.end("OK");
                }

                if (parts[2] === "user") {
                    return proxy.web(req, res,
                        { target: URLS.user },
                        err => {
                            res.statusCode = 502;
                            return res.end("Error: user api unreachable");
                        });
                }

                if (parts[2] === "chat") {
                    return proxy.web(req, res,
                        { target: URLS.chat },
                        err => {
                            res.statusCode = 502;
                            return res.end("Error: chat api unreachable");
                        }
                    );
                }

                if (parts[2] === "game") {
                    return proxy.web(req, res,
                        { target: URLS.game },
                        err => {
                            res.statusCode = 502;
                            return res.end("Error: game api unreachable");
                        }
                    );
                }

                if (parts[2] === "ai") {
                    return proxy.web(req, res,
                        { target: URLS.ai },
                        err => {
                            res.statusCode = 502;
                            return res.end("Error: ai api unreachable");
                        }
                    );
                }

                if (parts[2] === "shop") {
                    return proxy.web(req, res,
                        { target: URLS.shop },
                        err => {
                            res.statusCode = 502;
                            return res.end("Error: shop api unreachable");
                        }
                    );
                }

                res.statusCode = 404;
                return res.end("Unknown API domain");

            default:
                return proxy.web(req, res,
                    { target: URLS.files },
                    err => {
                        console.log("[GATEWAY] - File service down:", err);
                        res.statusCode = 502;
                        return res.end("File service unavailable");
                    });
        }

    } catch (e) {
        console.error("[GATEWAY] - Unexpected error:", e.message);
        res.statusCode = 400;
        res.end(`Something in your request (${req.url}) is strange...`);
    }
};

const getServer = () => {
    if (ENV !== "prod") return http.createServer(requestHandler);
    try {
        return https.createServer({
            cert: fs.readFileSync('/app/https/fullchain.pem'),
            key: fs.readFileSync('/app/https/privkey.pem')
        }, requestHandler);
    } catch (e) {
        console.error('[gateway] Erreur de création serveur HTTPS ' + e.message);
    }
};

const server = getServer();
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'], credentials: false } });

io.on('connection', socket => {
    console.log('[GATEWAY] connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('[GATEWAY] disconnected:', socket.id);
        gameClient.emit("disconnect", socket.id);
    });
});

// GAME NAMESPACE

const gameNamespace = io.of('/game');

gameNamespace.on('connection', socket => {
    console.log('[FRONT-GATEWAY-GAME] connected:', socket.id);

    const eventToRedirect = [
        'join', 'action', 'leave', 'send-message',
        'ask-draw', 'deny-draw', 'accept-draw', 'forfeit'
    ];

    eventToRedirect.forEach(event => socket.on(event, data => gameClient.emit(event, { clientId: socket.id, ...data })));

    socket.on("game-ws-service", ({ webSocketIds, event, data }) => {
        gameNamespace.to(webSocketIds).emit(event, data);
        console.log("[FRONT-GATEWAY-GAME] Broadcast to " + webSocketIds + " event: " + event);
    });
});

// USER NAMESPACE

const userNamespace = io.of('/user');

userNamespace.on('connection', socket => {
    console.log('[FRONT-GATEWAY-USER] connected:', socket.id);

    const eventToRedirect = ['register'];

    eventToRedirect.forEach(event => socket.on(event, data => {
        userClient.emit(event, { clientId: socket.id, ...data });
        console.log(`[FRONT-GATEWAY-USER] Redirected event "${event}" to user service`);
    }));

    socket.on('disconnect', () => {
        userNamespace.emit('disconnection', { clientId: socket.id });
    });

    socket.on("user-ws-service", ({ webSocketIds, event, data }) => {
        userNamespace.to(webSocketIds).emit(event, data);
        console.log(`[USER-GATEWAY-FRONT] Broadcasted event "${event}" to [${webSocketIds}]`);
    });
});

// CHAT NAMESPACE

const chatNamespace = io.of("/chat");
chatNamespace.on('connection', socket => {
    console.log("[FRONT-GATEWAY-CHAT] connected:", socket.id);

    chatClient.emit("register", { socketId: socket.id });

    const eventToRedirect = [];

    eventToRedirect.forEach(event => socket.on(event, data => {
        chatNamespace.emit(event, { clientId: socket.id, ...data });
        console.log(`[FRONT-GATEWAY-CHAT] Redirected event "${event}" to chat service`);
    }));

    socket.on("disconnect", () => {
        chatClient.emit("disconnection", { socketId: socket.id });
    });

    socket.on("chat-ws-service", ({ webSocketIds, event, data }) => {
        chatNamespace.to(webSocketIds).emit(event, data);
        console.log(`[CHAT-GATEWAY-FRONT] Broadcasted event "${event}" to [${webSocketIds}]`);
    });
});

server.listen(PORT, () => console.log(`[SERVER] ${ENV === "prod" ? "HTTPS" : "HTTP"} listening on port ${PORT}`));