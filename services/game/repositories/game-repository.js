import { MongoClient } from 'mongodb';

// Configuration MongoDB
const URL = process.env.MONGO_DB_URL || 'mongodb://localhost:27017';
const dbName = 'snelldb';
const client = new MongoClient(URL);

let db;
let game_collection;

export async function initDatabase() {
    try {
        await client.connect();
        console.log('[GAME REPO] - Connecté à MongoDB');
        db = client.db(dbName);
        game_collection = db.collection('game');
    } catch (error) {
        console.error('[GAME REPO] - Erreur de connexion MongoDB:', error);
        throw error;
    }
}

export async function closeDatabase() {
    try {
        await client.close();
        console.log('[GAME REPO] - Connexion MongoDB fermée');
    } catch (error) {
        console.error('[GAME REPO] - Erreur lors de la fermeture:', error);
    }
}

export async function findGameById(gameId) {
    try {
        const game = await game_collection.findOne({ gameId: gameId });
        if (!game) throw new Error("Game not found");
        return game;
    } catch (error) {
        console.error("[GAME REPO] - Error while retrieving the game with id: ", gameId);
    }
}

export async function saveGame(gameId, initGrid, actions, white_player_id, black_player_id, winnerId) {
    try {
        await game_collection.insertOne({ gameId, initGrid, actions, white_player_id, black_player_id, winnerId })
    } catch (error) {
        console.log("[GAME REPO] - Error while saving the game with id: ", gameId)
    }
}