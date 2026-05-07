import { PLAYER_ACTION } from "../enum/PlayerAction.js";
import { Logger } from "../utils/Logger.js";

import * as LaserService from "./LaserService.js";
import * as BoardService from "./BoardService.js";
import { Board } from "../model/Board.js";
import { Game } from "../model/Game.js";
import * as PlayerService from "../service/PlayerService.js";

import { COLORS } from "../enum/Colors.js";

import * as tutorialService from "./TutorialService.js"

import * as gameRepository from "../../repositories/game-repository.js";

const MIN_NB_PLAYER_REQUIRED = 2;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:8010";

let tutorial_steps = [];


export function launchGame(game) {
    isGameReady(game);
    Logger.log(`Game ${game.id} launched`);
}

export function createGame(gameType, timePerPlayer) {
    const board = BoardService.initBoard(new Board());
    return new Game(board, gameType, false, timePerPlayer);
}

export async function getGameReviewById(gameId) {
    return await gameRepository.findGameById(gameId);
}

export function computeGameReview(gameReview) {
    const game_states = [];

    // Mock players without websocketIds
    const white_player_mock = PlayerService.createPlayer(COLORS.WHITE, undefined, gameReview.white_player_id);
    const black_player_mock = PlayerService.createPlayer(COLORS.BLACK, undefined, gameReview.black_player_id);

    // Create a new game
    const initBoard = reconstructBoard(gameReview.initGrid)
    const game = new Game(initBoard, "MULTI", true);

    // Replace the new Id by the correct one and empty his action list to avoid INIT State COLLISION
    game.gameId = gameReview.gameId;
    game.actions = [];

    // Add player's mocks to the game
    game.addPlayer(white_player_mock);
    game.addPlayer(black_player_mock);

    // Compute all actions

    return computeGameSteps(game, gameReview.actions, true)
}

function reconstructBoard(initGrid) {
    const board = new Board();
    board.grid = initGrid.grid.map(binary => {
        const buffer = Buffer.from(binary.buffer);
        return new Uint8Array(buffer);
    });
    return board;
}


export function checkGameStatus(game) {
    const players = game.players;
    const white = players.find(p => p.getColor() === COLORS.WHITE);
    const black = players.find(p => p.getColor() === COLORS.BLACK);

    const whiteAliveAndConnected = white?.hasKingAlive() && white?.connected;
    const blackAliveAndConnected = black?.hasKingAlive() && black?.connected;

    if ((!whiteAliveAndConnected && !blackAliveAndConnected) || game.count >= 200) {
        return endGame(game, "DRAW");
    }

    if (!whiteAliveAndConnected) {
        return endGame(game, "BLACK");
    }

    if (!blackAliveAndConnected) {
        return endGame(game, "WHITE")
    }

    if (game.isGameOver) {
        return endGame(game, game.colorTurn === COLORS.WHITE ? "BLACK" : "WHITE");
    }

    return "CONTINUE";
}

async function updatePlayerElo(userId, newElo) {
    try {
        const response = await fetch(`${USER_SERVICE_URL}/api/user/add-elo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, elo: newElo })
        });

        if (!response.ok) {
            console.error(`[ELO] Failed to update user ${userId}: ${response.statusText}`);
        }
        return response.ok;
    } catch (error) {
        console.error(`[ELO] Network error for user ${userId}:`, error);
        return false;
    }
}

export function endGame(game, winner) {

    game.isGameOver = true;
    game.stopTimer();

    if (game.gameType === "MULTI" && !game.isReview) {

        const white_player = game.players.find((p) => p.color === COLORS.WHITE);
        const black_player = game.players.find((p) => p.color === COLORS.BLACK);

        const white_gain = game.gain[COLORS.WHITE];
        const black_gain = game.gain[COLORS.BLACK];

        let finalWhiteElo, finalBlackElo, winnerId;

        // Détermination des scores selon l'issue
        if (winner === "WHITE") {
            winnerId = white_player.userId;
            finalWhiteElo = white_gain.win;
            finalBlackElo = black_gain.loss;
            game.setLastAction("White won")
        } else if (winner === "BLACK") {
            winnerId = black_player.userId;
            finalWhiteElo = white_gain.loss;
            finalBlackElo = black_gain.win;
            game.setLastAction("Black won")
        } else { // DRAW
            winnerId = "DRAW";
            finalWhiteElo = white_gain.draw;
            finalBlackElo = black_gain.draw;
            game.setLastAction("DRAW")
        }

        // On lance les deux appels en parallèle pour plus de rapidité
        Promise.all([
            updatePlayerElo(white_player.userId, finalWhiteElo),
            updatePlayerElo(black_player.userId, finalBlackElo),
            addGameToHistory(white_player.userId, winnerId, game),
            addGameToHistory(black_player.userId, winnerId, game),
            saveGame(game, winnerId)
        ]).then(r => console.log("Game saved successfully"));
    }


    return winner;
}

async function saveGame(game, winnerId) {

    try {

        // Retrieve all informations from the game
        const initGrid = game.initGrid;
        const actions = game.actions;
        const white_player_id = game.getPlayerByColor(COLORS.WHITE).userId
        const black_player_id = game.getPlayerByColor(COLORS.BLACK).userId

        // Save the game
        const res = await gameRepository.saveGame(game.id, initGrid, actions, white_player_id, black_player_id, winnerId);
    } catch (error) {
        console.log("[GAME SERVICE] - Error while saving the game");
    }

}


export async function addGameToHistory(userId, winnerId, game) {

    const white_player = game.players.find((p) => p.color === COLORS.WHITE);
    const black_player = game.players.find((p) => p.color === COLORS.BLACK);

    let gameJson = { whiteId: white_player.userId, blackId: black_player.userId, gameId: game.id, winnerId: winnerId };

    const res = await fetch(`${USER_SERVICE_URL}/api/user/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, game: gameJson })
    });

}

export function placeAction(game, action, colorTurn) {

    let laserResult = { laserPath: [], white_triangle_shooted: 0, black_triangle_shooted: 0, killedPiecePosition: [] }

    let splited_action = action.split("/");
    switch (splited_action[0]) {
        case PLAYER_ACTION.MOVE:
            BoardService.move(game.board, action, colorTurn)
            laserResult = LaserService.shootBeam(game.board, game.colorTurn, game.players);
            break;
        case PLAYER_ACTION.ROTATE:
            BoardService.rotate(game.board, action, colorTurn)
            laserResult = LaserService.shootBeam(game.board, game.colorTurn, game.players);
            break;
        case PLAYER_ACTION.SWAP:
            const res = BoardService.swap(game.board, action, colorTurn);
            // If we swap with the shooter, then we can't shoot the laser beam
            if (res.allowed_to_shoot) { laserResult = LaserService.shootBeam(game.board, game.colorTurn, game.players); }
            break;
        case PLAYER_ACTION.PLACE:
            BoardService.place(game.getPlayerByColor(colorTurn), game.board, action, colorTurn)
            laserResult = LaserService.shootBeam(game.board, game.colorTurn, game.players);
            break;
        case PLAYER_ACTION.DRAW:
            return drawGame(game)
        case PLAYER_ACTION.FORFEIT:
            return forfeit(game, splited_action[1]);
        case PLAYER_ACTION.INIT:
            return getCurrentGameStatus(game);
        default:
            throw new Error(`Invalid Action ${action}`);
    }

    game.setLastAction(action);

    game.laserBeam = laserResult.laserPath;
    game.killedPiecePos = laserResult.killedPiecePosition;

    addTrianglesToInventories(game, laserResult.white_triangle_shooted, laserResult.black_triange_shooted);

    game.incrementCount();

    return getCurrentGameStatus(game);
}

export function isGameReady(game) {
    if (game.players.length < MIN_NB_PLAYER_REQUIRED) { throw new Error(`Game hasn't enough players to launch`); }
    return true;
}

export function addTrianglesToInventories(game, white_triangle_shooted, black_triangle_shooted) {
    const white_player = game.players.find((p) => p.color === COLORS.WHITE);
    const black_player = game.players.find((p) => p.color === COLORS.BLACK);

    PlayerService.addTriangleToInventory(white_player, black_triangle_shooted);
    PlayerService.addTriangleToInventory(black_player, white_triangle_shooted);
}


export function isPlayersTurn(game, player) {
    if (game.colorTurn !== player.getColor()) {
        throw new Error(`Player ${player.getUserId()} is not allowed to play`);
    } return true;
}

export function getCurrentGameStatus(game) {
    return {
        grid: game.board.grid.map(row => row.slice()), // copie chaque Uint8Array
        colorTurn: game.colorTurn,
        white_inventory: game.players[0].inventory.slice(), // copie aussi l'inventaire
        black_inventory: game.players[1].inventory.slice(),
        lastAction: game.lastAction,
        laserBeam: [...game.laserBeam],
        killedPiecePos: [...game.killedPiecePos],
        gameId: game.id,
        status: checkGameStatus(game),
        gameType: game.gameType,
        turnCount: game.turnCount,
        white_time: game.timers[COLORS.WHITE],
        black_time: game.timers[COLORS.BLACK],
        white: game.getPlayerByColor(COLORS.WHITE).getUserId(),
        black: game.getPlayerByColor(COLORS.BLACK).getUserId(),
        gain: game.gameType === "MULTI" && !game.isReview ? { white: game.gain[COLORS.WHITE], black: game.gain[COLORS.BLACK] } : undefined,
    }
}

export function decrementPiecesCD(game) {
    PlayerService.decrementInventoryCD(game.players.find(p => p.color === game.colorTurn));
    BoardService.decrementBoardPieces(game.board, game.colorTurn);
}

export function getPlayerSockets(game) {
    let players_socket = []
    game.players.forEach(p => {
        players_socket.push(p.webSocketId);
    });
    return players_socket;
}

export function checkPlayerTurn(game, player_web_socket) {
    const player = game.getPlayerByColor(game.colorTurn);
    if (player.webSocketId !== player_web_socket) {
        throw new Error(`Player ${player.webSocketId} can't play because it's not his turn`);
    }
}

export function drawGame(game) {
    game.players.forEach(p => p.kingAlive = false);
    return getCurrentGameStatus(game);
}

export function forfeit(game, userId) {
    game.setLastAction(`FORFEIT/${userId}`)
    game.players.find(p => p.userId === userId).kingAlive = false;
    return getCurrentGameStatus(game);
}


export function getTutorialSteps() {
    if (tutorial_steps.length === 0) {
        initTutorial();
        return tutorial_steps;
    }
    return tutorial_steps;
}

function initTutorial() {
    let tutorial_init = tutorialService.initTutorial();
    tutorial_steps = computeGameSteps(tutorial_init, tutorialService.tutorial_actions);
}

function computeGameSteps(game, actions, review = false) {
    const game_states = [];

    // Add the init state of the game
    game_states.push(getCurrentGameStatus(game));

    actions.forEach(action => {
        // While the game is not over, then continue to push actions
        if (!game.isGameOver) { game_states.push(placeAction(game, action, game.colorTurn)); }
    })

    // return all the computed game states
    return game_states;
}