import { badExpress } from '../helpers/badExpress.js';
import * as AiService from './AiService.js'
import * as engine from './engine.js';
import * as ai from './ai.js';
import * as aiService from './AiService.js';

const app = new badExpress();



app.get('/api/ais', (req, res) => {
    try {
        const ais = AiService.getAiDtos();
        res.json({ ais }, 200);
    } catch (error) {
        console.error(`Error white retrieving ais : ${error}`);
        res.json({ error: 'Error while retrieving ais', message: error.message }, 500);
    }
})

app.get('/api/ais/{id}', (req, res) => {
    try {
        const aiId = req.params.id;
        const ai = AiService.getAiDto(aiId);
        res.json({ ai }, 200);
    } catch (error) {
        console.error(`Error while retrieving ai : ${error}`);
        res.json({ error: 'Error while retrieving ai', message: error.message }, 500);
    }
})

app.post('/api/ais/evaluate', (req, res) => {
    try {
        const { grid, colorTurn, players } = req.body;

        // Driss si tu vois ça ne touche pas au undefined c'est pck colorTurn peut valoir 0 et !0 ça fait false
        if (!grid || colorTurn === undefined || !players) {
            return res.json({ error: 'Bad request' }, 400);
        }

        const game = aiService.deserializeGame(req.body);
        const score = ai.evaluate(game, colorTurn);


        // on fait vrmt comme chess com raf
        if (score === Infinity) return res.json({ score: "1 - 0" }, 200);
        if (score === -Infinity) return res.json({ score: "0 - 1" }, 200);


        res.json({ score }, 200);
    } catch (error) {
        console.error('Error evaluating position:', error);
        res.json({ error: 'Error evaluating position', message: error.message }, 400);
    }
});

app.post('/api/ais/{aiId}/best-action', (req, res) => {
    try {

        const aiId = req.params.AiId;


        const { grid, colorTurn, players } = req.body || {};

        if (!grid || colorTurn === undefined || !players)
            return res.json({ error: 'Bad request' }, 400);

        const game = aiService.deserializeGame(req.body);

        const action = aiService.getBestAction(game, aiId);

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
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}