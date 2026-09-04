import {MongoClient, ObjectId} from 'mongodb';

// Configuration MongoDB
const URL = process.env.MONGO_DB_URL || 'mongodb://localhost:27017';
const dbName = 'snelldb';
const client = new MongoClient(URL);

let db;
let friend_chat_collection;

export async function initDatabase() {
    try {
        await client.connect();
        db = client.db(dbName);
        friend_chat_collection = db.collection('friend_chat');
    } catch (error) {
        throw error;
    }
}

export function initFriendChat(userId, friendId) {
    const _id = new ObjectId();
    friend_chat_collection.insertOne({ _id, user1: userId, user2: friendId, messages: [] });
    return _id;
}

export function findChatById(chatId) {
    return friend_chat_collection.findOne({ _id: new ObjectId(chatId) });
}

export function addMessageToChat(message) {
    friend_chat_collection.updateOne(
        { _id: new ObjectId(message.chatId) },
        { $push: { messages: { message } } }
    );
}


export async function getUsersFromChat(chatId) {
    const chat = await friend_chat_collection.findOne({ _id: new ObjectId(chatId) });
    if (!chat) throw new Error("Chat not found");
    return { user1: chat.user1, user2: chat.user2 };
}

export async function closeDatabase() {
    try {
        await client.close();
    } catch (error) {
        console.error('[CHAT SERVICE] - Erreur lors de la fermeture:', error);
    }
}