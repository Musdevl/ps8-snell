import { badExpress } from '../../helpers/badExpress.js';
import { gatewayConnection, formatToSend } from '../src/shared.js';


const app = new badExpress();

let gameManager;

// POST /api/game
app.post('/api/game', async (req, res) => {
    try {

        const gameType = req.body.gameType;
        const players = req.body.players;

        await gameManager.initGame(gameType, { userId: players[0] }, { userId: players[1] })

        res.json({ message: 'Game created' }, 200);

    } catch (error) {
        console.error('Error while creating game:', error);
        res.json({ error: 'Error while creating game', message: error.message }, 503);
    }
});

app.get('/api/game/review/{gameId}', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const gameReview = await gameManager.getGameReview(gameId);
        res.json(gameReview, 200)
    } catch (error) {
        console.log(error);
        res.json({ error: 'Error while retrieving the game review ' }, 503)
    }
})

app.get('/api/game/tutorial', async (req, res) => {
    try {
        const tutorial_steps = gameManager.getTutorialSteps();
        if (tutorial_steps) {
            return res.json({ grid_states: tutorial_steps }, 200);
        } else {
            throw new Error("Failed to retrieve the tutorial steps");
        }
    } catch (error) {
        console.log(error);
        res.json({ error: 'Error while retrieving the tutorial steps' }, 503)
    }
})

app.get('/api/game/puzzles', async (req, res) => {
    try {
        const puzzles = gameManager.getPuzzles();
        if (puzzles) {
            return res.json({ puzzles: puzzles }, 200);
        } else {
            throw new Error("Failed to retrieve puzzles");
        }
    } catch (error) {
        console.log(error)
        res.json({ error: 'Error while retrieving puzzles' }, 503)
    }
})

app.get('/api/game/puzzles/{puzzleId}', async (req, res) => {

    const puzzleId = req.params.puzzleId;

    console.log(puzzleId);
    try {
        const puzzle = gameManager.getPuzzleDetails(puzzleId);
        if (puzzle) {
            return res.json({ puzzle: puzzle }, 200);
        } else {
            throw new Error("Failed to retrieve puzzle");
        }

    } catch (error) {
        console.log(error)
        res.json({ error: `Error while retrieving puzzle with id ${puzzleId}` }, 503)
    }
})

app.post('/api/game/forward-message', async (req, res) => {
    try {
        const { gameId, message } = req.body;
        const res = await gameManager.processMessage(gameId, message);
        return gatewayConnection.emit("game-ws-service", formatToSend(res.players_web_sockets, "new-message", res.message));

        res.json("Message successfully forwared", 200);
    } catch (error) {
        console.log("[User API] Failed to forward the message to the gateway", error);
        res.json("Failed to forward the message", 503);
    }

})

// Start the server
export function startHttpServer(port, newGameManager) {
    gameManager = newGameManager;
    const PORT = port;
    const server = app.listen(PORT, () => {
        console.log(`[GAME SERVER] Server listening on port ${PORT}`);
    });

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}