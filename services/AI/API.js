import { badExpress } from '../helpers/badExpress.js';
import * as engine from './engine.js';
import * as ai from './AI.js';

const app = new badExpress();

function deserializeGame(body) {
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

app.post('/api/ai/evaluate', (req, res) => {
    try {
        const { grid, colorTurn, players } = req.body;

        // Driss si tu vois ça ne touche pas au undefined c'est pck colorTurn peut valoir 0 et !0 ça fait false
        if (!grid || colorTurn === undefined || !players) {
            return res.json({error: 'Bad request'}, 400);
        }

        const game = deserializeGame(req.body);
        const score = ai.evaluate(game, colorTurn);


        // on fait vrmt comme chess com raf
        if (score === Infinity)  return res.json({ score: "1 - 0" }, 200);
        if (score === -Infinity) return res.json({ score: "0 - 1" }, 200);


        res.json({ score }, 200);
    } catch (error) {
        console.error('Error evaluating position:', error);
        res.json({ error: 'Error evaluating position', message: error.message }, 400);
    }
});

app.post('/api/ai/best-action', (req, res) => {
    try {
        const { grid, colorTurn, players } = req.body || {};

        if (!grid || colorTurn === undefined || !players)
            return res.json({ error: 'Bad request' }, 400);

        const game = deserializeGame(req.body);
        const action = ai.getBestAction(game, 2);

        res.json({ action }, 200);
    } catch (error) {
        console.error('Error getting best action:', error);
        res.json({ error: 'Error getting best action', message: error.message }, 400);
    }
});


export function startHttpServer() {
    const PORT = 8020;
    const server = app.listen(PORT, () => {
        console.log(`[AI] Server listening on port ${PORT}`);
    });

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT',  () => { app.close(() => { process.exit(0); }); });

    return server;
}