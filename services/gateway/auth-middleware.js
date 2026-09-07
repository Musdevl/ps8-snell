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
                    return false;
                }

                // Token expiré -> tentative de refresh via header
                if (!refreshHeader) {
                    return false;
                }
                try {
                    const decodedRefresh = jwt.verify(refreshHeader, env.jwt_refresh_key);
                    const newAccessToken = createToken(decodedRefresh.id, env.jwt_key, env.jwt_access_expiration || "15m");
                    return { token: newAccessToken, decoded: decodedRefresh, isNew: true };
                } catch (refreshErr) {
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
                    return false;
                }
            }
        }

        // Refresh via cookie
        const refreshToken = findToken(cookieHeader, "jwt_refresh_token");
        if (!refreshToken) {
            return false;
        }

        const decodedRefresh = jwt.verify(refreshToken, env.jwt_refresh_key);
        const newAccessToken = createToken(decodedRefresh.id, env.jwt_key, env.jwt_access_expiration || "15m");
        return { token: newAccessToken, decoded: decodedRefresh, isNew: true };

    } catch (err) {
        return false;
    }
}

module.exports = {
    middleware: { verifyToken, createToken, findToken },
    protected_http_routes,
};