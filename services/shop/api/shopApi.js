import { badExpress } from '../../helpers/badExpress.js';
import * as shopService from "../services/shopService.js";

const app = new badExpress();

// GET /api/shop/items
app.get('/api/shop/items', async (req, res) => {
    try {
        const items = shopService.get_shop_items();

        res.json({ items }, 200);
    } catch (error) {
        console.error('Error while retrieving shop items', error);
        res.json({ error: 'Error while retrieving shop items', message: error.message }, 400);
    }
});

// GET /api/shop/daily-items
app.get('/api/shop/daily-items', async (req, res) => {
    try {
        const items = shopService.getDailyItems();
        res.json({ items }, 200);
    } catch (error) {
        console.error('Error while retrieving shop items', error);
        res.json({ error: 'Error while retrieving shop items', message: error.message }, 400);
    }
});

// POST /api/shop/items
app.post('/api/shop/purchase', async (req, res) => {
    try {
        const userId = req.body.userId;
        const item = req.body.item;

        await shopService.purchase(item.id, userId);
        res.json("Item purchased successfully", 200);
    } catch (error) {
        console.error('Error while retrieving shop items', error);
        res.json({ error: 'Error while retrieving shop items', message: error.message }, 400);
    }
});


// Start the server
export function startHttpServer(port) {
    const PORT = port;
    const server = app.listen(PORT, () => {});

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}