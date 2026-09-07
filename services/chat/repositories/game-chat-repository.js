import { MongoClient } from 'mongodb';

const URL = process.env.MONGO_DB_URL || 'mongodb://localhost:27017';
const dbName = 'snelldb';
const client = new MongoClient(URL);
let db;
let game_chat_collection;

export async function initDatabase() {
    try {
        await client.connect();
        db = client.db(dbName);
        game_chat_collection = db.collection('game_chat');
    } catch (error) {
        console.error('[CHAT SERVICE] - Erreur de connexion MongoDB:', error);
        throw error;
    }
}

export async function initGameChat(gameId) {
    try {

        const result = await game_chat_collection.insertOne({ gameId: gameId, messages: [], createdAt: new Date() });

        return result;
    } catch (error) {
        console.error('[CHAT SERVICE] - Erreur lors de la création du chat:', error);
        throw error;
    }
}

export async function getGameChat(gameId) {
    const doc = await game_chat_collection.findOne({ gameId: { $eq: gameId } });
    return doc ? doc.messages : [];
}

export async function addMessageToChat(gameId, message) {
    try {
        let e = await getGameChat(gameId);
        const result = await game_chat_collection.updateOne( 
            { gameId: { $eq: gameId } },
            { $push: { messages: message } }
        );
        e = await getGameChat(gameId);
        return result;
    } catch (error) {
        console.error('[GAME_CHAT_REPO] - Erreur lors de l\'ajout du message:', error);
        throw error;
    }
}

export async function closeDatabase() {
    try {
        await client.close();
    } catch (error) {
        console.error('[GAME_CHAT_REPO] - Erreur lors de la fermeture:', error);
    }
}