import { MongoClient } from "mongodb";
import { config } from "../config.js";

const client = new MongoClient(config.mongoUrl);

let db;
let tokens_collection;

export async function initDatabase() {
    try {
        await client.connect();
        db = client.db(config.dbName);
        tokens_collection = db.collection("mail_tokens");

        // Mongo purge tout seul les tokens périmés (le champ expiresAt fait foi).
        // La vérification d'expiration reste faite en code : le ramasse-miettes
        // de Mongo ne tourne que toutes les 60s environ.
        await tokens_collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
        await tokens_collection.createIndex({ tokenHash: 1 }, { unique: true });

        console.log("[MAIL REPO] - Connecté à MongoDB");
    } catch (error) {
        console.error("[MAIL REPO] - Erreur de connexion MongoDB:", error);
        throw error;
    }
}

export async function closeDatabase() {
    try {
        await client.close();
        console.log("[MAIL REPO] - Connexion MongoDB fermée");
    } catch (error) {
        console.error("[MAIL REPO] - Erreur lors de la fermeture:", error);
    }
}

export async function saveToken(token) {
    await tokens_collection.insertOne({ ...token, createdAt: new Date() });
    return token;
}

export async function findByHash(tokenHash) {
    return await tokens_collection.findOne({ tokenHash });
}

/**
 * Marque le token comme consommé, mais seulement s'il ne l'était pas déjà.
 * Le filtre sur consumedAt rend l'opération atomique : deux clics simultanés
 * sur le même lien ne peuvent pas réussir tous les deux.
 */
export async function consume(tokenHash) {
    const result = await tokens_collection.updateOne(
        { tokenHash, consumedAt: null },
        { $set: { consumedAt: new Date() } }
    );
    return result.modifiedCount === 1;
}

/** Invalide les tokens encore en attente du même type pour cet utilisateur. */
export async function revokePending(userId, type) {
    await tokens_collection.updateMany(
        { userId, type, consumedAt: null },
        { $set: { consumedAt: new Date() } }
    );
}
