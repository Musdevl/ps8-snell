// AUTH MIDDLEWARE
const { env } = require("../helpers/env.js");
const jwt = require("jsonwebtoken");

const protected_http_routes = [];

function findToken(cookieHeader, tokenName) {
    if (!cookieHeader) return null;
    const match = cookieHeader
        .split(";")
        .map(c => c.trim())
        .find(c => c.startsWith(`${tokenName}=`));
    return match ? match.split("=")[1] : null;
}

function createToken(id, key, expiration) {
    return jwt.sign({ id }, key, { expiresIn: expiration });
}

function verifyToken(cookieHeader, authHeader, refreshHeader) {
    try {
        // 1. Bearer token (Capacitor)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, env.jwt_key);
                return { token, decoded, isNew: false };
            } catch (err) {
                if (err.name !== 'TokenExpiredError') {
                    console.log("[AUTH-MIDDLEWARE] - Invalid Bearer token:", err.message);
                    return false;
                }

                // Token expiré -> tentative de refresh via header
                console.log("[AUTH-MIDDLEWARE] - Expired Bearer token, trying refresh...");
                if (!refreshHeader) {
                    console.log("[AUTH-MIDDLEWARE] - No refresh token provided");
                    return false;
                }
                try {
                    const decodedRefresh = jwt.verify(refreshHeader, env.jwt_refresh_key);
                    const newAccessToken = createToken(decodedRefresh.id, env.jwt_key, env.jwt_access_expiration || "15m");
                    console.log("[AUTH-MIDDLEWARE] - Access token refreshed for user:", decodedRefresh.id);
                    return { token: newAccessToken, decoded: decodedRefresh, isNew: true };
                } catch (refreshErr) {
                    console.log("[AUTH-MIDDLEWARE] - Invalid refresh token:", refreshErr.message);
                    return false;
                }
            }
        }

        // Fallback cookies
        const accessToken = findToken(cookieHeader, "jwt_token");
        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, env.jwt_key);
                return { token: accessToken, decoded, isNew: false };
            } catch (accessErr) {
                if (accessErr.name !== "TokenExpiredError") {
                    console.log("[AUTH-MIDDLEWARE] - Invalid access token:", accessErr.message);
                    return false;
                }
                console.log("[AUTH-MIDDLEWARE] - Expired Token Access");
            }
        }

        // Refresh via cookie
        const refreshToken = findToken(cookieHeader, "jwt_refresh_token");
        if (!refreshToken) {
            console.log("[AUTH-MIDDLEWARE] - No refresh token found");
            return false;
        }

        const decodedRefresh = jwt.verify(refreshToken, env.jwt_refresh_key);
        const newAccessToken = createToken(decodedRefresh.id, env.jwt_key, env.jwt_access_expiration || "15m");
        console.log("[AUTH-MIDDLEWARE] - Access token refreshed for user:", decodedRefresh.id);
        return { token: newAccessToken, decoded: decodedRefresh, isNew: true };

    } catch (err) {
        console.log("[AUTH-MIDDLEWARE] - Token verification failed:", err.message);
        return false;
    }
}

module.exports = {
    middleware: { verifyToken, createToken, findToken },
    protected_http_routes,
};