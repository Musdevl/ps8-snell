import { MongoClient, ObjectId } from 'mongodb';

const URL = process.env.MONGO_DB_URL || 'mongodb://localhost:27017';
const CHAT_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:8003';
const dbName = 'snelldb';
const client = new MongoClient(URL);

let db;
let usersCollection;

export async function initDatabase() {
    try {
        await client.connect();
        console.log('[REPO] - Connecté à MongoDB');
        db = client.db(dbName);
        usersCollection = db.collection('users');
    } catch (error) {
        console.error('[REPO] - Erreur de connexion MongoDB:', error);
        throw error;
    }
}


export async function findByEmail(email) {
    return await usersCollection.findOne({ email });
}

export async function saveUser(user) {
    try {
        if (user._id) {
            await usersCollection.replaceOne({ _id: user._id }, user, { upsert: true });
            return user;
        }
        const result = await usersCollection.insertOne({ ...user, createdAt: new Date() });
        const savedUser = { ...user, id: result.insertedId };
        console.log("[REPO] - Added a new user : ", savedUser);
        return savedUser;
    } catch (error) {
        console.error('[REPO] - Erreur lors de la sauvegarde:', error);
        throw error;
    }
}


export async function getUserByEmail(email) {
    return await usersCollection.findOne({ email });
}

export async function setElo(userId, elo) {
    await updateUser(userId, { $set: { elo } });
}

export async function findUserById(userId) {
    try {
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) throw new Error("User not found");
        return user;
    } catch (error) {
        console.error('[REPO] - Erreur findUserById:', error);
        throw error;
    }
}

export async function addFriend(userId, friendId) {
    const user = await findUserById(userId);
    const friend = await findUserById(friendId);

    // Vérification avant d'appeler le chat
    if (user.friends.some(f => f.friendId.toString() === friendId.toString())) {
        throw new Error("Users already friends");
    }

    console.log(userId, friendId)

    try {
        const reqChat = await fetch(CHAT_URL + "/api/chat/friend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user1: userId, user2: friendId })
        });

        const chatJson = await reqChat.json();
        console.log(chatJson);
        const chatId = chatJson.id;

        user.friends.push({ friendId, chatId });
        friend.friends.push({ friendId: userId, chatId });

        await saveUser(user);
        await saveUser(friend);
    } catch (error) {
        console.log(error);
        throw new Error(error.message);
    }
}

export async function removeFriend(userId, friendId) {
    const user = await findUserById(userId);
    const friend = await findUserById(friendId);

    if (!user.friends.some(f => f.friendId.toString() === friendId.toString())) {
        throw new Error("Users are not friends");
    }

    user.friends = user.friends.filter(f => f.friendId.toString() !== friendId.toString());
    friend.friends = friend.friends.filter(f => f.friendId.toString() !== userId.toString());

    await saveUser(user);
    await saveUser(friend);
}

export async function getUserWithCredentials(email, password) {
    try {
        const user = await usersCollection.findOne({ email, password });
        if (user) console.log("[REPO] - User found : ", user);
        return user || null;
    } catch (error) {
        console.error('[REPO] - Erreur lors de la recherche:', error);
        throw error;
    }
}

export async function printRepo() {
    try {
        const users = await usersCollection.find({}).toArray();
        console.log("[REPO] - Users : ", users);
        return users;
    } catch (error) {
        console.error('[REPO] - Erreur lors de la récupération:', error);
        throw error;
    }
}

export async function findUserByUsername(username) {
    try {
        const user = await usersCollection.findOne({ username });
        return user;
    } catch (error) {
        console.error('[REPO] - Erreur lors de la recherche:', error);
        throw error;
    }
}

export async function closeDatabase() {
    try {
        await client.close();
        console.log('[REPO] - Connexion MongoDB fermée');
    } catch (error) {
        console.error('[REPO] - Erreur lors de la fermeture:', error);
    }
}

export async function areUserInformationsValid(email, username) {
    try {
        const user = await usersCollection.findOne({ $or: [{ email }, { username }] });
        if (user) console.log("[REPO] - User informations already taken");
        return !!user;
    } catch (error) {
        console.error('[REPO] - Erreur lors de la recherche:', error);
        throw error;
    }
}


export async function searchUsersByUsername(query, limit = 5) {
    try {
        const users = await usersCollection
            .find({ username: { $regex: `^${query}`, $options: 'i' } })
            .limit(limit)
            .toArray();
        return users.map(u => ({ id: u._id, username: u.username, elo: u.elo }));
    } catch (error) {
        console.error('[REPO] - Erreur searchUsersByUsername:', error);
        throw error;
    }
}


export async function incrementWin(userId) {
    await updateUser(userId, { $inc: { gamesWon: 1 } });
}


export async function incrementLoss(userId) {
    await updateUser(userId, { $inc: { gamesLost: 1 } });
}

export async function incrementDraw(userId) {
    await updateUser(userId, { $inc: { gamesDrawn: 1 } });
}


export async function pushInHistory(userId, game_history) {
    const user = await findUserById(userId);
    user.game_history.push(game_history);
    await saveUser(user);
}

export async function completeAchievement(userId, achievement) {
    const user = await findUserById(userId);
    const found = user.achievements?.find((a) => a.name === achievement.name);

    if (found && !found.isCompleted) {
        await usersCollection.updateOne(
            { _id: new ObjectId(userId), "achievements.name": achievement.name },
            {
                $set: { "achievements.$.isCompleted": true },
                $inc: { snell_coins: achievement.reward?.snell_coins || 0 }
            }
        );
        return true;
    }

    return false;
}

export async function updateSelectedEmotes(userId, selected_emotes) {
    await updateUser(userId, { $set: { selected_emotes } });
}

export async function updateProfilePicture(userId, picture) {
    await updateUser(userId, { $set: { picture } });
}

export async function updateSelectedTheme(userId, selected_theme) {
    await updateUser(userId, { $set: { selected_theme } });
}

export async function updateUser(userId, update) {
    try {
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            update
        );
        if (result.matchedCount === 0) {
            throw new Error("Aucun utilisateur trouvé avec cet ID : " + userId);
        }
    } catch (error) {
        console.error('[REPO] - Erreur updateUser:', error);
        throw error;
    }
}


export async function addEmoteToInventory(userId, emote) {
    await usersCollection.updateOne(
        { _id: new ObjectId(userId), "emotes.id": { $ne: emote.id } },
        {
            $push: { emotes: emote },
            $inc: { snell_coins: -emote.unit_price }
        }
    );
}

export async function addProfilePicture(userId, profile_picture) {
    await usersCollection.updateOne(
        { _id: new ObjectId(userId), "profile_picture_list.id": { $ne: profile_picture.id } },
        {
            $push: { profile_picture_list: profile_picture },
            $inc: { snell_coins: -profile_picture.unit_price }
        }
    );
}

export async function addTheme(userId, theme) {
    await usersCollection.updateOne(
        { _id: new ObjectId(userId), "themes.id": { $ne: theme.id } },
        {
            $push: { themes: theme },
            $inc: { snell_coins: -theme.unit_price }
        }
    );
}

export async function addSnellCoins(userId, amount) {
    await updateUser(userId, { $inc: { snell_coins: amount } });
}

export async function getLeaderboard(limit = 100) {
    const users = await usersCollection
        .find({})
        .sort({ elo: -1 })
        .limit(limit)
        .toArray();

    return users.map((u, index) => ({
        rank: index + 1,
        username: u.username,
        picture: u.picture,
        elo: u.elo,
    }));
}


export async function getUserRank(userId) {
    const user = await findUserById(userId);
    const rank = await usersCollection.countDocuments({ elo: { $gt: user.elo } });
    return rank + 1;
}

// ── Réinitialisation de mot de passe ─────────────────────────────────────────

export async function saveResetToken(userId, tokenHash, expiresAt) {
    await updateUser(userId, { $set: { reset_token: tokenHash, reset_token_expires: expiresAt } });
}

export async function findByResetToken(tokenHash) {
    return await usersCollection.findOne({ reset_token: tokenHash });
}

export async function setPasswordAndClearToken(userId, hashedPassword) {
    await updateUser(userId, {
        $set: { password: hashedPassword },
        $unset: { reset_token: "", reset_token_expires: "" },
    });
}