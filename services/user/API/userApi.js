// USER API 
import { badExpress } from '../../helpers/badExpress.js';
import * as UserApiHandler from "./userApiHandler.js";
import { env } from "../../helpers/env.js"

const app = new badExpress();


// GET /api/user/verify
app.get('/api/user/verify', (req, res) => {
    const token = req.headers?.authorization?.split(' ')[1] || req.query?.jwt_token;
    try {
        UserApiHandler.verifyToken(token, env.jwt_key);
        res.json({ ok: true }, 200);
    } catch (e) {
        res.json({ error: 'Unauthorized' }, 401);
    }
});

// POST /api/user/register
app.post('/api/user/register', async (req, res) => {
    try {

        const { email, username, password } = req.body || {};

        if (!email || !username || !password) {
            return res.json({ error: 'Bad request' }, 400);
        }
        await UserApiHandler.createUser(email, username, password);

        const user = await UserApiHandler.findUser(email, password);

        const jwt_token = UserApiHandler.createToken(user._id.toString(), env.jwt_key, env.jwt_access_expiration || '15m');
        const jwt_refresh_token = UserApiHandler.createToken(user._id.toString(), env.jwt_refresh_key, env.jwt_refresh_expiration || '7d');

        res.cookie('jwt_refresh_token', jwt_refresh_token, {
            httpOnly: true,
            // sameSite: 'Strict',
            maxAge: 60 * 60 * 24 * 7, // 7 jours en secondes
            secure: process.env.ENV === 'prod',

        });

        res.cookie('jwt_token', jwt_token, {
            httpOnly: true,
            // sameSite: 'Strict',
            maxAge: 15 * 60, // 15 minutes
            secure: process.env.ENV === 'prod',    // HTTPS uniquement (en prod)
        });



        res.json({ user, jwt_token, jwt_refresh_token }, 200);
    } catch (error) {
        console.error('Error creating user:', error);
        res.json({ error: 'Error creating user', message: error.message }, 400);
    }
});

// POST /api/user/login
app.post('/api/user/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.json({ error: 'Bad request' }, 400);
        }
        const user = await UserApiHandler.findUser(email, password);
        const jwt_token = UserApiHandler.createToken(user._id.toString(), env.jwt_key, env.jwt_access_expiration || '15m');
        const jwt_refresh_token = UserApiHandler.createToken(user._id.toString(), env.jwt_refresh_key, env.jwt_refresh_expiration || '7d');

        res.cookie('jwt_refresh_token', jwt_refresh_token, {
            httpOnly: true,
            // sameSite: 'Strict',
            maxAge: 60 * 60 * 24 * 7, // 7 jours en secondes
            secure: process.env.ENV === 'prod',

        });

        res.cookie('jwt_token', jwt_token, {
            httpOnly: true,
            // sameSite: 'Strict',
            maxAge: 15 * 60, // 15 minutes
            secure: process.env.ENV === 'prod',    // HTTPS uniquement (en prod)
        });

        // On renvoie le token dans le body à cause de Capacitor :(
        res.json({ user, jwt_token, jwt_refresh_token }, 200);

    } catch (error) {
        console.error('Error logging in:', error);
        res.json({ error: 'Invalid credentials', message: error.message }, 400);
    }
});


// GET /api/user/info/{userId}
app.get('/api/user/info/{userId}', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await UserApiHandler.getUserInformation(userId);
        res.json(user, 200);
    } catch (error) {
        console.error('Error while getting user information:', error);
        res.json({ error: 'Error while getting user information', message: error.message }, 400);
    }
});

app.put('/api/user/profile-picture', async (req, res) => {
    try {
        const userId = req.body.userId;
        const picture = req.body.profile_picture;
        await UserApiHandler.updateProfilePicture(userId, picture);
        res.json('Profile picture saved successfully', 204);
    } catch (error) {
        console.log('Error while saving profile picture', error);
        res.json({ error: "Error while saving profile picture" }, 400)
    }
})


app.post("/api/user/friend-requests", async (req, res) => {
    try {
        const userId = req.body.userId;
        const result = await UserApiHandler.getUserFriendRequests(userId);
        return res.json(result, 200);
    } catch (error) {
        console.log('Error while retrieving friend requests')
    }
})

// POST /api/user/friend/add  envoie une demande d'ami
app.post('/api/user/friend/add', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await UserApiHandler.requestFriend(userId, friendId);
        res.json({ message: 'Friend request sent successfully' }, 200);
    } catch (error) {
        console.error('Error sending friend request:', error);
        res.json({ error: 'Error sending friend request', message: error.message }, 400);
    }
});

// GET /api/user/search/{query}
app.get('/api/user/search/{query}', async (req, res) => {
    try {
        const { query } = req.params;
        if (!query || query.trim().length === 0) return res.json([], 200);
        const users = await UserApiHandler.searchUsers(query.trim());
        res.json(users, 200);
    } catch (error) {
        console.error('Error searching users:', error);
        res.json({ error: 'Error searching users', message: error.message }, 400);
    }
});


app.put('/api/user/selected-emotes', async (req, res) => {
    try {
        const selected_emotes = req.body.selected_emotes;
        const userId = req.body.userId;
        await UserApiHandler.updateSelectedEmotes(selected_emotes, userId);
        res.json("Selected emotes successfully saved", 204)
    } catch (error) {
        console.log('Error while saving selected emotes', error);
        res.json({ error: 'Error while saving selected emotes' }, 400)
    }
})

app.put('/api/user/selected-theme', async (req, res) => {
    try {
        const selected_theme = req.body.selected_theme;
        const userId = req.body.userId;
        await UserApiHandler.updateSelectedTheme(userId, selected_theme);
        res.json("Selected theme successfully saved", 204)
    } catch (error) {
        console.log('Error while saving selected theme', error);
        res.json({ error: 'Error while saving selected theme' }, 400)
    }
})


// POST /api/user/friend/accept
app.post('/api/user/friend/accept', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await UserApiHandler.acceptFriendRequest(userId, friendId);
        const result = await UserApiHandler.getUserFriendRequests(friendId);
        res.json({ message: 'Friend request accepted successfully', friendsRequests: result }, 200);
    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.json({ error: 'Error accepting friend request', message: error.message }, 400);
    }
});

// POST /api/user/friend/decline
app.post('/api/user/friend/decline', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await UserApiHandler.declineFriendRequest(userId, friendId);
        res.json({ message: 'Friend request declined successfully' }, 200);
    } catch (error) {
        console.error('Error declining friend request:', error);
        res.json({ error: 'Error declining friend request', message: error.message }, 400);
    }
});

app.post('/api/user/forward-message', async (req, res) => {
    try {
        const { users, message } = req.body;

        const result = await UserApiHandler.forwardMessage(users, message);
        res.json({ message: result }, 200);
    } catch (error) {
        console.log("[User API] Failed to forward the message to the gateway", error);
        res.json("Failed to forward the message", 500);
    }

})

// POST /api/user/set-elo

app.post('/api/user/add-elo', async (req, res) => {
    try {
        const { userId, elo } = req.body;
        await UserApiHandler.addElo(userId, elo);
        res.json({ message: 'ELO set successfully' }, 200);
    }
    catch (e) {
        console.error(e);
        res.json({ error: 'Error setting ELO', message: e.message }, 400);
    }
})

// POST /api/user/friend/remove
app.post('/api/user/friend/remove', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        await UserApiHandler.removeFriend(userId, friendId);
        res.json({ message: 'Friend removed successfully' }, 200);
    } catch (error) {
        console.error('Error removing friend:', error);
        res.json({ error: 'Error removing friend', message: error.message }, 400);
    }
});


// POST /api/user/chat
app.post("/api/user/chat", async (req, res) => {
    try {

        const message = req.body;

        await UserApiHandler.postMessage(message);

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.json({ error: 'Error sending message', message: e.message }, 400);
    }
});

app.post('/api/user/logout', (req, res) => {
    console.log("[USER] - User logged out");

    res.clearCookie('jwt_token', {
        httpOnly: true
        , sameSite: 'Strict'
    });
    res.clearCookie('jwt_refresh_token', {
        httpOnly: true
        , sameSite: 'Strict'
    });

    res.json({ succes: true });
});

app.get('/api/user/getId/{username}', async (req, res) => {
    try {
        const { username } = req.params;
        const userId = await UserApiHandler.getUserIdFromUsername(username);
        res.json(userId, 200);
    } catch (error) {
        console.error('Error getting user information:', error);
        res.json({ error: 'Error getting user information', message: error.message }, 400);
    }
})


app.post('/api/user/challenge', async (req, res) => {
    try {
        const { userId, opponentId } = req.body;
        await UserApiHandler.requestChallenge(userId, opponentId);
        res.json({ message: 'Challenge request sent successfully' }, 200);
    } catch (error) {
        console.error('Error challenging friend:', error);
        res.json({ error: 'Error challenging friend', message: error.message }, 400);
    }
})

app.post('/api/user/challenge/accept', async (req, res) => {
    try {
        const players = req.body;
        await UserApiHandler.acceptChallenge(players[0], players[1]);
        res.json({ message: 'Challenge request accepted' });
    } catch (error) {
        console.log('Error challenging failed: ', error);
        res.json({ error: 'Error: challenging failed', message: error.message }, 502)
    }
})

// POST /api/user/forgot-password
// Envoie le lien de réinitialisation par mail.
app.post('/api/user/forgot-password', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.json({ error: 'Email requis' }, 400);

        // Le lien doit pointer vers le site tel que l'utilisateur l'a atteint,
        // pour rester valable quel que soit le serveur qui héberge le jeu.
        const origin = req.headers.origin || process.env.PUBLIC_GATEWAY_URL || 'http://localhost:8000';

        await UserApiHandler.requestPasswordReset(email, origin);

        res.json({ message: "Si un compte existe pour cette adresse, un mail vient d'être envoyé" }, 200);
    }
    catch (e) {
        console.error(e);
        res.json({ error: "Impossible d'envoyer le mail" }, 400);
    }
})

// POST /api/user/reset-password
// Applique le nouveau mot de passe à partir du token reçu par mail.
app.post('/api/user/reset-password', async (req, res) => {
    try {
        const { token, new_password } = req.body || {};
        await UserApiHandler.resetPassword(token, new_password);

        res.json({ message: "Reset success" }, 200);
    }
    catch (e) {
        console.error(e);
        res.json({ error: 'Error resetting password', message: e.message }, 400);
    }

})

app.post('/api/user/hard-reset-password', async (req, res) => {
    try {
        let { email, new_password } = req.body;
        await UserApiHandler.hardResetPassword(email, new_password);
        res.json({ message: "Reset success" }, 200);
    }
    catch (e) {
        console.error(e);
        res.json({ error: 'Error resetting password', message: e.message }, 400);
    }

})

app.post('/api/user/achievement', async (req, res) => {
    try {
        const achievement = req.body.achievement;
        const userId = req.body.userId;
        await UserApiHandler.completeAchievement(userId, achievement);

    } catch (error) {
        console.log("Failed to add achievement - ", error)
    }
})



app.post("/api/user/history", async (req, res) => {
    try {
        let { userId, game } = req.body;
        await UserApiHandler.addGameHistory(userId, game);
        console.log("History posted successfully", userId, JSON.stringify(game));
        res.json({ message: 'History posted successfully' }, 200);
    }
    catch (error) {
        console.log(error);
        res.json({ error: 'Error posting history', message: error.message }, 400);
    }
})


app.post("/api/user/inventory/add-purchased-item", async (req, res) => {
    try {
        let { userId, item } = req.body;
        await UserApiHandler.addItem(userId, item);
        res.json("Item successfully added to inventory", 200);
    } catch (e) {
        console.log("[USER SERVICES] - ", e);
        res.json({ error: 'Failed to save item to inventory' }, 400);
    }
})

// STRIPE

// Crée la session de paiement Stripe
app.post('/api/user/shop/create-checkout', async (req, res) => {
    try {
        const { userId } = req.body || {};

        if (!userId || typeof userId !== 'string') {
            return res.json({ error: 'Bad request', message: 'userId is required' }, 400);
        }

        if (!process.env.STRIPE_SECRET_KEY || !process.env.PUBLIC_GATEWAY_URL) {
            console.error('[STRIPE] Missing STRIPE_SECRET_KEY or PUBLIC_GATEWAY_URL env variable');
            return res.json({ error: 'Payment unavailable' }, 500);
        }

        const params = new URLSearchParams({
            'payment_method_types[0]': 'card',
            'line_items[0][price_data][currency]': 'eur',
            'line_items[0][price_data][product_data][name]': '5000 Snell Coins',
            'line_items[0][price_data][unit_amount]': '99', // centimes
            'line_items[0][quantity]': '1',
            'mode': 'payment',
            'client_reference_id': userId,
            'success_url': `${process.env.PUBLIC_GATEWAY_URL}/pages/shop/success/?session_id={CHECKOUT_SESSION_ID}&userId=${userId}`,
            'cancel_url': `${process.env.PUBLIC_GATEWAY_URL}/`,
        });

        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const session = await response.json();

        if (!response.ok) {
            console.error('[STRIPE] Failed to create checkout session:', session.error);
            return res.json({ error: 'Failed to create checkout session', message: session.error?.message }, 502);
        }

        res.json({ url: session.url }, 200);
    } catch (e) {
        console.error('[STRIPE] Error creating checkout session:', e);
        res.json({ error: 'Failed to create checkout session', message: e.message }, 400);
    }
});


// Vérifie le paiement et crédite les coins
app.get('/api/user/shop/verify', async (req, res) => {
    const { session_id, userId } = req.query;

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });

    const session = await response.json();

    if (session.payment_status === 'paid') {
        await UserApiHandler.addSnellCoin(userId, 5000);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/user/leaderboard', async (req, res) => {
    try {
        const leaderboard = await UserApiHandler.getLeaderboard();
        res.json(leaderboard, 200);
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.json({ error: 'Error getting leaderboard', message: error.message }, 400);
    }
})


app.get('/api/user/leaderboard/{userId}', async (req, res) => {
    try {
        const rank = await UserApiHandler.getUserRank(req.params.userId);
        res.json({ rank });
    } catch (e) {
        res.json({ error: e.message }, 500);
    }
});

// Start the server
export function startHttpServer() {
    const PORT = 8010;
    const server = app.listen(PORT, () => { });

    process.on('SIGTERM', () => { app.close(() => { process.exit(0); }); });
    process.on('SIGINT', () => { app.close(() => { process.exit(0); }); });

    return server;
}
