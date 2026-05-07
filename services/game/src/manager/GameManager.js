import * as gameService from "../service/GameService.js";
import { COLORS } from "../enum/Colors.js";
import { Logger } from "../utils/Logger.js"
import * as PlayerService from "../service/PlayerService.js";
import * as AiService from "../service/AiService.js";
import { EventEmitter } from "events";
import * as gameRepository from "../../repositories/game-repository.js"

export class GameManager extends EventEmitter {

    games;

    USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010";
    CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://localhost:8003";
    ACHIEVEMENT_SERVICE_URL = process.env.ACHIEVEMENT_SERVICE_URL || "http://localhost:8004";
    AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8020"


    constructor() {
        super();
        this.games = new Map();
        initDatabase();
    }

    async initGame(gameType, player_1_info, player_2_info, gameTime = 600) {

            const game = gameService.createGame(gameType, gameTime);

            const white_player = PlayerService.createPlayer(COLORS.WHITE, player_1_info.webSocketId, player_1_info.userId)

            let black_player;

            if (gameType === "AI") {
                black_player = PlayerService.createPlayer(COLORS.BLACK, "NONE", "AI");
            } else {
                black_player = PlayerService.createPlayer(COLORS.BLACK, player_2_info.webSocketId, player_2_info.userId);
            }

            if (gameType === "MULTI") {
                // Create a new chat
                const res = await fetch(`${this.CHAT_SERVICE_URL}/api/chat/game`, {
                    method: "POST",
                    body: JSON.stringify({
                        gameId: game.id
                    }),
                    headers: { "Content-type": "application/json; charset=UTF-8" }
                });

                if (!res.ok) {
                    throw new Error("Failed to create game chat at initialization")
                }

                let reqInfoWhite = await fetch(`${this.USER_SERVICE_URL}/api/user/info/${player_1_info.userId}`, { method: "GET" });
                let reqInfoBlack = await fetch(`${this.USER_SERVICE_URL}/api/user/info/${player_2_info.userId}`, { method: "GET" });

                let userWhite = await reqInfoWhite.json();
                let userBlack = await reqInfoBlack.json();

                game.gain = this.getEloChanges(userWhite.elo, userBlack.elo);
            }

            game.on("TIMEOUT", () => {
                this.handleTimeout(game)
            })

            game.addPlayer(white_player);
            game.addPlayer(black_player);



            this.games.set(game.id, game);
            gameService.launchGame(game);

            return { game: gameService.getCurrentGameStatus(game), players_web_sockets: gameService.getPlayerSockets(game) };
    }

    async getGameReview(gameId) {
        const gameReview = await gameService.getGameReviewById(gameId);
        return {
            grid_states: gameService.computeGameReview(gameReview),
            actions: gameReview.actions,
            white_player_id: gameReview.white_player_id,
            black_player_id: gameReview.black_player_id
        }
    }


    getEloChanges(whiteElo, blackElo, kFactor = 20) {

        const calculateForScore = (scoreWhite) => {
            // Probabilité que Blanc gagne
            const expectedWhite = 1 / (1 + Math.pow(10, (blackElo - whiteElo) / 400));
            const expectedBlack = 1 - expectedWhite;

            const scoreBlack = 1 - scoreWhite;

            return {
                whiteChange: Math.round(kFactor * (scoreWhite - expectedWhite)),
                blackChange: Math.round(kFactor * (scoreBlack - expectedBlack))
            };
        };

        const winScenarios = calculateForScore(1);
        const drawScenarios = calculateForScore(0.5);
        const lossScenarios = calculateForScore(0);

        return {
            [COLORS.WHITE]: {
                win: winScenarios.whiteChange,
                draw: drawScenarios.whiteChange,
                loss: lossScenarios.whiteChange
            },
            [COLORS.BLACK]: {
                win: lossScenarios.blackChange,
                draw: drawScenarios.blackChange,
                loss: winScenarios.blackChange
            }
        };
    }


    handleTimeout(game) {
        this.emit("timeout", { game: gameService.getCurrentGameStatus(game), players_web_sockets: gameService.getPlayerSockets(game) });
    }

    processAction(game, action, player_socket_id) {
        try {
            gameService.checkPlayerTurn(game, player_socket_id);
            gameService.decrementPiecesCD(game);
            const previous_state = gameService.getCurrentGameStatus(game);
            const next_state = gameService.placeAction(game, action, game.colorTurn);
            this.lookForAchievement(previous_state, next_state)
            return { game: next_state, players_web_sockets: gameService.getPlayerSockets(game) }
        } catch (error) { Logger.error(error); }
    }

    async processAiAction(game) {
        try {

            const req = await fetch(`${this.AI_SERVICE_URL}/api/ai/best-action`, {
                method:'POST',
                body:JSON.stringify({
                    grid: game.board.grid,
                    players: game.players,
                    colorTurn: game.colorTurn
                })
            })
            let resp = await req.json()
            let action = resp.action
            gameService.decrementPiecesCD(game);

            console.log("AI ACTION: ", action)

            return {
                game: gameService.placeAction(game, action, game.colorTurn),
                players_web_sockets: gameService.getPlayerSockets(game)[0]
            };

        } catch (error) { Logger.error(error); }
    }

    findGame(gameId) {
        const game = this.games.get(gameId);
        if (game) {
            return game;
        } else {
            throw new Error(`No Game Found`);
        }
    }

    askDraw(gameId, userId) {
        const game = this.findGame(gameId)
        if (game.findPlayer(userId) && game.gameType === "MULTI") {
            game.stopTimer();
            return {
                players_web_sockets: game.findOpponent(userId).webSocketId
            };
        }
    }

    acceptDraw(gameId, userId) {
        const game = this.findGame(gameId);
        if (game.findPlayer(userId) && game.gameType === "MULTI") {
            const res = gameService.drawGame(game);
            return {
                game: res,
                players_web_sockets: gameService.getPlayerSockets(game)
            }
        }
    }

    denyDraw(gameId, userId) {
        const game = this.findGame(gameId);
        if (game.findPlayer(userId) && game.gameType === "MULTI") {
            game.startTimer();
            return {
                players_web_sockets: gameService.getPlayerSockets(game)
            }
        }
    }

    tryReconnect(playerInfo, gameType) {
        // ToDo: Fetch userId from the jwtToken
        for (const game of this.games.values()) {
            if (!game.isGameOver && game.reconnect(playerInfo.userId, playerInfo.webSocketId) && game.gameType === gameType) {
                return {
                    game: gameService.getCurrentGameStatus(game),
                    players_web_sockets: playerInfo.webSocketId
                };
            }
        }

        return false;
    }

    leaveGame(gameId, userId) {
        const game = this.findGame(gameId);
        game.leave(userId);
        if (game.gameType === "MULTI") {
            let other_web_socket = game.findOpponent(userId).webSocketId;
            return {
                game: gameService.getCurrentGameStatus(game),
                players_web_sockets: other_web_socket
            }
        }
        return false;
    }

    forfeit(gameId, userId) {
        const game = this.findGame(gameId);
        if (game.gameType === "MULTI" && game.findPlayer(userId)) {
            return {
                game: gameService.forfeit(game, userId),
                players_web_sockets: gameService.getPlayerSockets(game)
            }
        }
    }

    async processMessage(gameId, message) {

        // Censure Message

        const game = this.findGame(gameId);

        console.log("RECEIVED MESSAGE", message)

        const userResponse = await fetch(
            `${this.USER_SERVICE_URL}/api/user/info/${message.userId}`,
            { method: "GET" }
        );

        const user = await userResponse.json();

        message.username = user.username
        message.picture = user.picture.picture

        return { message, players_web_sockets: gameService.getPlayerSockets(game) }
    }

    async lookForAchievement(previous_game_state, next_game_state) {
        try {
            await fetch(`${this.ACHIEVEMENT_SERVICE_URL}/api/achievement/in-game`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        previous_game_state: this.serializeGameState(previous_game_state),
                        next_game_state: this.serializeGameState(next_game_state)
                    }),
                    headers: { "Content-type": "application/json; charset=UTF-8" }
                }

            );
        } catch (error) {
            console.log("Failed to reach Achievement Service - ", error);
        }
    }

    serializeGameState(state) {
        return {
            ...state,
            grid: state.grid.map(row => Array.from(new Uint8Array(row))),
            white_inventory: Array.from(new Uint8Array(state.white_inventory)),
            black_inventory: Array.from(new Uint8Array(state.black_inventory)),
        };
    }

    getTutorialSteps() {
        return gameService.getTutorialSteps();
    }
}

function initDatabase() {
    gameRepository.initDatabase();
}