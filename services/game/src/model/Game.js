import { Logger } from "../utils/Logger.js";
import { COLORS } from "../enum/Colors.js"
import { EventEmitter } from "events";
import crypto from "crypto";

export class Game extends EventEmitter {

    id; // int
    players; // Players[]
    colorTurn; // Player
    board; // Board
    initGrid;
    turnCount; // int
    lastAction; // string
    laserBeam; // [[int]]
    killedPiecePos;// [int]
    actions; // [string]
    gameType; // String
    eloGain; // int
    timers; // { [COLORS.WHITE]: int, [COLORS.BLACK]: int } (en secondes)
    intervalId; // Pour stopper le décompte
    isGameOver; // boolean
    isReview; // boolean

    constructor(board, gameType, isReview = false, timeLimit = 600) {
        super();
        this.id = crypto.randomUUID();
        this.players = []
        this.colorTurn = COLORS.WHITE;
        this.board = board;
        this.initGrid = board ? board.clone() : undefined; // si l'on vient de créer la game pour la review, on a pas encore d'état init
        this.turnCount = 0;
        this.laserBeam = [];
        this.killedPiecePos = [];
        this.actions = ["INIT"];
        this.lastAction = "INIT";
        this.gameType = gameType;
        this.timers = {
            [COLORS.WHITE]: timeLimit,
            [COLORS.BLACK]: timeLimit
        };
        this.eloGain = {
            [COLORS.WHITE]: {
                win: 0,
                draw: 0,
                loss: 0,
            },
            [COLORS.BLACK]: {
                win: 0,
                draw: 0,
                loss: 0,
            },
        }
        this.isGameOver = false;
        this.intervalId = null;
        this.isReview = isReview;
    }

    startTimer() {
        if (this.isReview) return;
        if (this.intervalId) clearInterval(this.intervalId);

        this.intervalId = setInterval(() => {
            if (this.isGameOver) {
                clearInterval(this.intervalId);
                return;
            }

            this.timers[this.colorTurn]--;

            if (this.timers[this.colorTurn] <= 0) {
                this.endGameByTimeout();
            }
        }, 1000); // Décrémente toutes les secondes
    }

    endGameByTimeout() {
        if (this.isReview) return;
        this.isGameOver = true;
        this.lastAction = "TIMEOUT";
        clearInterval(this.intervalId);

        const loser = this.colorTurn;
        const winner = loser === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // On émet l'événement de fin de partie
        this.emit("TIMEOUT");
    }


    addPlayer(player) {
        if (!this.players.includes(player.getUserId())) {
            this.players.push(player);
            Logger.log(`Player ${player.getUserId()} joined!`);
        } else {
            Logger.error(`Player ${player.getUserId()} already in game`);
        }
    }

    removePlayer(player) {
        if (this.players.includes(player)) {
            this.players.splice(this.players.indexOf(player), 1);
            Logger.log(`Player ${player.getUserId()} leaved the game`)
        } else {
            Logger.error(`Player ${player.getUserId()} not in game`);
        }
    }

    setColorTurn(player) {
        if (this.players.includes(player.getUserId())) {
            this.colorTurn = player;
            Logger.log(`Player turn set to ${player.getUserId()}`);
        } else {
            Logger.error(`Player ${player.getUserId()} not in game`);
        }
    }

    incrementCount() {
        this.turnCount++;
        this.colorTurn = this.colorTurn === COLORS.BLACK ? COLORS.WHITE : COLORS.BLACK;

        // On relance le timer pour le nouveau joueur
        if (!this.isGameOver) {
            this.startTimer();
        }
    }

    stopTimer() {
        clearInterval(this.intervalId);
    }


    getPlayerByColor(playerColor) {
        return this.players.find((player) => player.getColor() === playerColor);
    }

    getPlayerById(playerId) {
        return this.players.find((player) => player.getUserId() === playerId);
    }

    setLastAction(action) {
        this.actions.push(action);
        return this.lastAction = action;
    }

    setLaserBeam(laserBeam) {
        this.laserBeam = laserBeam;
    }

    addAction(action) {
        this.actions.push(action)
    }

    saveBoard() {
        this.gridStates.push(this.board.grid);
    }

    reconnect(userId, newWebSocketId) {
        let found = false;
        for (const player of this.players) {
            if (player.userId === userId) {
                player.webSocketId = newWebSocketId;
                player.connected = true;
                found = true;
            }
        }
        return found;
    }

    isPlayerConnected(userId) {
        return this.findPlayer(userId).connected;
    }

    leave(userId) {
        this.findPlayer(userId).connected = false;
        this.isGameOver = true;
    }

    findPlayer(userId) {
        const player = this.players.find(p => p.userId === userId);
        if (!player) throw new Error("Player not found while checking connectivity");
        return player;
    }

    findOpponent(userId) {
        if (this.findPlayer(userId)) {
            return this.players.find(p => p.userId !== userId)
        }
    }

    clone() {
        const cloned = new Game(this.board.clone(), this.gameType);

        cloned.id = this.id;
        cloned.colorTurn = this.colorTurn;
        cloned.turnCount = this.turnCount;
        cloned.lastAction = this.lastAction;
        cloned.laserBeam = this.laserBeam.map(cell => ({ ...cell }));
        cloned.isGameOver = this.isGameOver;
        cloned.timers = { ...this.timers };
        cloned.players = this.players.map(p => p.clone());

        // Pas de timer actif sur le clone — c'est une simulation
        cloned.intervalId = null;

        return cloned;
    }


}