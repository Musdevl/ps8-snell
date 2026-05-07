import { badExpress } from '../../helpers/badExpress.js';
import * as achievementService from "../services/achievementService.js";

const app = new badExpress();

// POST /api/game
app.post('/api/achievement/in-game', async (req, res) => {
    try {

        const previous = req.body.previous_game_state;
        const next = req.body.next_game_state;

        achievementService.searchInGameAchievements(previous, next);

        res.json({ message: 'Achievement handle game states' }, 200);

    } catch (error) {
        console.error('Error while looking for in game achievements:', error);
        res.json({ error: 'Error while looking for in game achievements', message: error.message }, 400);
    }
});

app.get('/api/achievements/blank', (req, res) => {
    try {

        res.json(JSON.stringify({achievements: achievementService.getBlankAchievements()}), 200);

    } catch (error) {
        console.log('Error while retrieving blank achievements', error)
        res.json({ error: 'Error while retrieving blank achievements' }, 400);
    }
})


// Start the server
export function startHttpServer(port) {
    const PORT = port;
    const server = app.listen(PORT, () => {
        console.log(`[ACHIEVEMENT SERVICE] Server listening on port ${PORT}`);
    });

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}