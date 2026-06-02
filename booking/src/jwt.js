const jwt = require('jsonwebtoken');

/**
 * Decodes and verifies a JWT token using jsonwebtoken.
 * 
 * @param {string} token 
 * @param {string} secret 
 * @param {array} allowedAlgs 
 * @returns {object|null} Returns decoded payload or null on failure.
 */
function verifyToken(token, secret, allowedAlgs = ['HS256']) {
    try {
        if (!token || !secret) {
            return null;
        }
        return jwt.verify(token, secret, { algorithms: allowedAlgs });
    } catch (e) {
        console.error('JWT verification error:', e.message);
        return null;
    }
}

/**
 * Signs a payload with a secret key.
 * 
 * @param {object} payload 
 * @param {string} secret 
 * @param {string} algorithm 
 * @returns {string|null}
 */
function signToken(payload, secret, algorithm = 'HS256') {
    try {
        return jwt.sign(payload, secret, { algorithm });
    } catch (e) {
        console.error('JWT sign error:', e.message);
        return null;
    }
}

module.exports = {
    verifyToken,
    signToken
};
