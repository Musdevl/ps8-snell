// import { ai } from "./ai.js";
import { MathiasHellal } from "./model/MathiasHellal.js";
import { DeyannKoperecz } from "./model/DeyannKoperecz.js";
import { BotBizot } from "./model/BotBizot.js";
import { PatrickLaChine } from "./model/PatrickLaChine.js";
import { PatrickBizcotos } from "./model/PatrickBizcotos.js";
import { PatrickTemplier } from "./model/PatrickTemplier.js";
import { PatrickBizot } from "./model/PatrickBizot.js";

const all_ais = [
    new PatrickLaChine(1),
    new MathiasHellal(2),
    new PatrickBizot(3),
    new PatrickTemplier(4),
    new PatrickBizcotos(5),
    new DeyannKoperecz(6),
    new BotBizot(7),
];

export function getAiDtos() {
    return all_ais.map(a => a = a.toDto())
}

export function getAiDto(aiId) {
    return findAi(aiId).toDto();
}

export function getBestAction(aiId) {
    return findAi(aiId).getBestAction();
}

export function deserializeGame(body) {
    const { grid, colorTurn, players } = body;

    const board = new engine.Board();
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            board.setSlot(r, c, grid[r][c]);
        }
    }

    const game = new engine.Game(board);
    game.colorTurn = colorTurn;

    game.players = players.map(p => {
        const player = new engine.Player(p.color);
        player.kingAlive = p.kingAlive;
        player.inventory = new Uint8Array(Object.values(p.inventory));
        return player;
    });

    return game;
}

function findAi(aiId) {
    const ai = all_ais.find((ai) => ai.id === Number(aiId));
    if (!ai) {
        throw new Error(`AI with id ${aiId} not found`);
    }
    return ai;
}