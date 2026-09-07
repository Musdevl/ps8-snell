import { MongoClient, ObjectId } from 'mongodb';

// Configuration MongoDB
const URL = process.env.MONGO_DB_URL || 'mongodb://localhost:27017';
const USER_URL = process.env.USER_SERVICE_URL || 'http://localhost:8010';
const dbName = 'snelldb';
const client = new MongoClient(URL);

let db;
let global_chat_collection;

export async function initDatabase() {
    try {
        await client.connect();
        db = client.db(dbName);
        global_chat_collection = db.collection('global_chat');
    } catch (error) {
        console.error('[FRIEND_CHAT_REPO] - Erreur de connexion MongoDB:', error);
        throw error;
    }
}

export async function addMessageToGlobalChat(message) {

    const userReq = await fetch(`${USER_URL}/api/user/info/${message.userId}`, {
        method: "GET"
    });

    const user = await userReq.json();

    message.picture = user.picture.picture;
    message.username = user.username;
    message.date = Date.now();


    await global_chat_collection.updateOne(
        {},
        { $push: { messages: { message: message } } },
        { upsert: true } // on fait ca pour créé le document si c'est vide
    );
}


export async function getAllMessages() {
    return await global_chat_collection.findOne({});
}


export async function closeDatabase() {
    try {
        await client.close();
    } catch (error) {
        console.error('[FRIEND_CHAT_REPO] - Erreur lors de la fermeture:', error);
    }
}