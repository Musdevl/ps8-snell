import { badExpress } from '../../helpers/badExpress.js';
import * as dockerService from '../services/dockerService.js';
import * as userService from '../services/userService.js';
import * as systemService from '../services/systemService.js';

const app = new badExpress();

// GET /api/admin/containers
app.get('/api/admin/containers', async (req, res) => {
    try {
        const containers = await dockerService.getSnellContainers();

        res.json({ containers }, 200);
    } catch (error) {
        console.error('[ADMIN API] - Erreur lors de la récupération des containers', error);
        res.json({ error: 'Error while retrieving containers', message: error.message }, 500);
    }
});

// GET /api/admin/containers/stats
app.get('/api/admin/containers/stats', async (req, res) => {
    try {
        const containers = await dockerService.getSnellContainersStats();

        res.json({ containers }, 200);
    } catch (error) {
        console.error('[ADMIN API] - Erreur lors de la récupération des stats containers', error);
        res.json({ error: 'Error while retrieving container stats', message: error.message }, 500);
    }
});

// GET /api/admin/system
app.get('/api/admin/system', (req, res) => {
    try {
        res.json(systemService.getSystemStats(), 200);
    } catch (error) {
        console.error('[ADMIN API] - Erreur lors de la récupération des perfs serveur', error);
        res.json({ error: 'Error while retrieving system stats', message: error.message }, 500);
    }
});

// GET /api/admin/online
app.get('/api/admin/online', async (req, res) => {
    try {
        const online = await userService.getOnlineUsers();

        res.json(online, 200);
    } catch (error) {
        console.error('[ADMIN API] - Erreur lors de la récupération des users connectés', error);
        res.json({ error: 'Error while retrieving online users', message: error.message }, 500);
    }
});

// GET /api/admin/registrations?days=7
app.get('/api/admin/registrations', async (req, res) => {
    try {
        const days = Number(req.query?.days) || 7;
        const stats = await userService.getRegistrationStats(days);

        res.json(stats, 200);
    } catch (error) {
        console.error('[ADMIN API] - Erreur lors de la récupération des inscriptions', error);
        res.json({ error: 'Error while retrieving registrations', message: error.message }, 500);
    }
});

// Start the server
export function startHttpServer(port) {
    const PORT = port;
    const server = app.listen(PORT, () => {
        console.log(`[ADMIN SERVICE] Server listening on port ${PORT}`);
    });

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}
