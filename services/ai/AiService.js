// import { ai } from "./ai.js";
import { BasicAi } from "./model/BasicAi.js";
import { MediumAi } from "./model/MediumAi.js";
import { HardAi } from "./model/HardAi.js";

const all_ais = [
    new BasicAi(1),
    new MediumAi(2),
    new HardAi(3),
];

export function getAiDtos() {
    return all_ais.map(a => a = a.toDto())
}

export function getAiDto(aiId) {
    const ai = all_ais.find((ai) => ai.id === Number(aiId));
    if (!ai) {
        throw new Error(`AI with id ${aiId} not found`);
    }
    return ai.toDto();
}

export function getBestAction(aiId) {
    try {
        const ai = all_ais.find(ai => ai.id === Number(aiId));
        if (ai) {
            return ai.getBestAction();
        }
        throw new Error(`Ai not found : ${aiId}`)
    } catch (error) {
        console.log("Failed to find best ai action :", error);
    }
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