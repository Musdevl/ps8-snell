import { MongoClient } from 'mongodb';

const URL = process.env.MONGO_DB_URL || 'mongodb://localhost:27017';
const dbName = 'snelldb';
const client = new MongoClient(URL);

let db;
let FRcollection;

export async function initDatabase() {
    try {
        await client.connect();
        console.log('[REPO] - Connecté à MongoDB');
        db = client.db(dbName);
        FRcollection = db.collection('friendRequest');
    } catch (error) {
        console.error('[REPO] - Erreur de connexion MongoDB:', error);
        throw error;
    }
}

export async function saveFriendRequest(userId, friendId) {
    try {
        const result = await FRcollection.insertOne({
            userId,
            friendId,
            createdAt: new Date()
        });
        console.log("[REPO] - Added a new friend request : ", result);
        return result;
    } catch (error) {
        console.error('[REPO] - Erreur lors de la sauvegarde:', error);
        throw error;
    }
}

export async function getFriendRequests(userId) {
    return await FRcollection.find({ friendId: userId }).toArray();
}

export async function findFriendRequest(userId, friendId) {
    const request = await FRcollection.findOne({
        $or: [
            { userId, friendId },
            { userId: friendId, friendId: userId }
        ]
    });
    if (!request) throw new Error("Friend request not found");
    return request;
}

export async function deleteRequest(userId, friendId) {
    const result = await FRcollection.deleteOne({
        $or: [
            { userId, friendId },
            { userId: friendId, friendId: userId }
        ]
    });
    if (result.deletedCount === 0) throw new Error("No request for those ID");
}

export async function createFriendRequest(userId, friendId) {
    const existing = await FRcollection.findOne({
        $or: [
            { userId, friendId },
            { userId: friendId, friendId: userId }
        ]
    });
    if (existing) throw new Error("Friend request already exists");
    await saveFriendRequest(userId, friendId);
}

export async function closeDatabase() {
    try {
        await client.close();
        console.log('[REPO] - Connexion MongoDB fermée');
    } catch (error) {
        console.error('[REPO] - Erreur lors de la fermeture:', error);
    }
}