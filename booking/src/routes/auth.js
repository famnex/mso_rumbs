const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbQuery } = require('../db');
const { verifyToken, signToken } = require('../jwt');
const fs = require('fs');
const path = require('path');

// Global JWT Config defaults
let jwtConfig = {
    enabled: true,
    secret: 'IhrSichererSharedSecretSchluesselHier',
    parameter_name: 'token',
    sso_url: 'https://cloud.mso-hef.de/launcher/',
    auto_create_user: true,
    default_authlevel: 2,
    logout_redirect_url: '',
    allowed_algorithms: ['HS256'],
    field_mapping: {
        username: 'username',
        firstname: 'firstname',
        lastname: 'lastname',
        email: 'email'
    }
};

// Load JWT Config from local/config.php if exists
const configPath = path.join(__dirname, '../../local/config.php');
if (fs.existsSync(configPath)) {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        // Simple regex parsing to extract all jwt parameters from local/config.php
        const secretMatch = configContent.match(/'secret'\s*=>\s*'([^']*)'/);
        const ssoMatch = configContent.match(/'sso_url'\s*=>\s*'([^']*)'/);
        const enabledMatch = configContent.match(/'enabled'\s*=>\s*(true|false)/);
        const paramMatch = configContent.match(/'parameter_name'\s*=>\s*'([^']*)'/);
        const autoMatch = configContent.match(/'auto_create_user'\s*=>\s*(true|false)/);
        const roleMatch = configContent.match(/'default_authlevel'\s*=>\s*(\d+)/);
        const logoutRedirectMatch = configContent.match(/'logout_redirect_url'\s*=>\s*'([^']*)'/);

        if (secretMatch) jwtConfig.secret = secretMatch[1];
        if (ssoMatch) jwtConfig.sso_url = ssoMatch[1];
        if (enabledMatch) jwtConfig.enabled = enabledMatch[1] === 'true';
        if (paramMatch) jwtConfig.parameter_name = paramMatch[1];
        if (autoMatch) jwtConfig.auto_create_user = autoMatch[1] === 'true';
        if (roleMatch) jwtConfig.default_authlevel = parseInt(roleMatch[1]);
        if (logoutRedirectMatch) jwtConfig.logout_redirect_url = logoutRedirectMatch[1];
    } catch (e) {
        console.error('Failed to parse local/config.php for JWT config:', e.message);
    }
}

// GET /login
router.get('/login', async (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }

    // Get any system message (usually loaded from DB or settings)
    const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
    const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

    res.render('login', {
        title: 'Login',
        schoolName,
        jwtConfig,
        error: req.session.error || null,
        success: req.session.success || null
    });
    // Clear flash values
    req.session.error = null;
    req.session.success = null;
});

// POST /login (Local Authentication)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        req.session.error = 'Benutzername und Passwort sind erforderlich.';
        return res.redirect('/login');
    }

    try {
        const user = await dbQuery.get("SELECT * FROM users WHERE username = ? AND enabled = 1", [username]);
        if (!user) {
            req.session.error = 'Ungültiger Benutzername und/oder Passwort.';
            return res.redirect('/login');
        }

        if (!user.password) {
            req.session.error = 'Ungültiger Benutzername und/oder Passwort.';
            return res.redirect('/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.session.error = 'Ungültiger Benutzername und/oder Passwort.';
            return res.redirect('/login');
        }

        // Set session
        req.session.userId = user.user_id;
        req.session.username = user.username;
        req.session.authlevel = user.authlevel;
        req.session.displayName = user.displayname || user.firstname || user.username;

        // Touch last login
        await dbQuery.run("UPDATE users SET lastlogin = ? WHERE user_id = ?", [new Date().toISOString(), user.user_id]);

        req.session.save((err) => {
            if (err) console.error('Session save error:', err);
            res.redirect('/bookings');
        });

    } catch (e) {
        console.error('Login error:', e);
        req.session.error = 'Ein interner Fehler ist aufgetreten.';
        res.redirect('/login');
    }
});

// GET /logout
router.get('/logout', (req, res) => {
    const redirectTarget = jwtConfig.logout_redirect_url || '/login';
    req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        res.redirect(redirectTarget);
    });
});

// GET /login/jwt (JWT SSO Redirect Endpoint)
router.get('/login/jwt', async (req, res) => {
    if (req.session.userId) {
        return res.redirect('/bookings');
    }

    if (!jwtConfig.enabled) {
        req.session.error = 'JWT Single Sign-On ist nicht aktiviert.';
        return res.redirect('/login');
    }

    const tokenParam = jwtConfig.parameter_name || 'token';
    const token = req.query[tokenParam] || req.query.token || req.query.sso_token;

    if (!token) {
        // If we have a configured SSO URL and we haven't attempted it yet in this flow,
        // redirect the browser to the SSO portal to obtain a token instead of showing an error.
        if (jwtConfig.sso_url && !req.session.sso_attempted) {
            req.session.sso_attempted = true;
            console.log(`JWT SSO: No token passed, redirecting user to SSO portal: ${jwtConfig.sso_url}`);
            return res.redirect(jwtConfig.sso_url);
        }

        // If we already attempted or don't have an SSO URL, reset flag and show error
        req.session.sso_attempted = null;
        req.session.error = 'Kein gültiges Authentifizierungstoken übergeben.';
        return res.redirect('/login');
    }

    // Clear SSO attempt flag since we received a token
    req.session.sso_attempted = null;

    // Verify token
    let payload = null;
    try {
        const jwtLib = require('jsonwebtoken');
        payload = jwtLib.verify(token, jwtConfig.secret, { algorithms: jwtConfig.allowed_algorithms });
    } catch (e) {
        console.error('JWT SSO verification failed:', e.message);
        req.session.error = `Sitzungsverifizierung fehlgeschlagen: ${e.message}`;
        return res.redirect('/login');
    }

    // Extract username based on claim mapping
    const usernameKey = jwtConfig.field_mapping.username || 'username';
    const username = payload[usernameKey];

    if (!username) {
        req.session.error = 'Benutzername konnte nicht aus dem Token gelesen werden.';
        return res.redirect('/login');
    }

    try {
        let user = await dbQuery.get("SELECT * FROM users WHERE username = ?", [username]);

        // JIT user provisioning
        if (!user) {
            if (jwtConfig.auto_create_user) {
                const firstnameKey = jwtConfig.field_mapping.firstname || 'firstname';
                const lastnameKey = jwtConfig.field_mapping.lastname || 'lastname';
                const emailKey = jwtConfig.field_mapping.email || 'email';

                const firstname = payload[firstnameKey] || '';
                const lastname = payload[lastnameKey] || '';
                const email = payload[emailKey] || '';
                const displayname = `${firstname} ${lastname}`.trim() || username;

                await dbQuery.run(
                    `INSERT INTO users (username, firstname, lastname, email, displayname, authlevel, enabled, created) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                    [username, firstname, lastname, email, displayname, jwtConfig.default_authlevel, new Date().toISOString()]
                );
                console.log(`JWT SSO: Provisioned new user account for: ${username}`);
                user = await dbQuery.get("SELECT * FROM users WHERE username = ?", [username]);
            } else {
                req.session.error = 'Dieses Benutzerkonto existiert im Buchungssystem nicht.';
                return res.redirect('/login');
            }
        }

        // Account status check
        if (user.enabled !== 1) {
            req.session.error = 'Ihr Benutzerkonto ist deaktiviert.';
            return res.redirect('/login');
        }

        // Complete passwordless login session establishment
        req.session.userId = user.user_id;
        req.session.username = user.username;
        req.session.authlevel = user.authlevel;
        req.session.displayName = user.displayname || user.firstname || user.username;

        // Touch last login
        await dbQuery.run("UPDATE users SET lastlogin = ? WHERE user_id = ?", [new Date().toISOString(), user.user_id]);

        console.log(`JWT SSO: Successfully authenticated user ${username} via SSO`);

        const redirectTo = payload.redirect_to && payload.redirect_to !== '/dashboard' ? payload.redirect_to : '/bookings';
        req.session.save((err) => {
            if (err) console.error('SSO Session save error:', err);
            res.redirect(redirectTo);
        });

    } catch (e) {
        console.error('JWT SSO Auth database error:', e);
        req.session.error = 'Datenbankfehler bei der SSO-Authentifizierung.';
        res.redirect('/login');
    }
});

// GET /test_sso.php or /test_sso
router.get(['/test_sso.php', '/test_sso'], async (req, res) => {
    try {
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        const header = { alg: 'HS256', typ: 'JWT' };
        const payload = {
            username: 'testlehrer',
            firstname: 'Steffen',
            lastname: 'Fleischer',
            email: 's.fleischer@mso-hef.de',
            exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        };

        const token = signToken(payload, jwtConfig.secret);
        const sso_link = `/login/jwt?token=${token}`;

        res.render('test_sso', {
            title: 'JWT SSO Test-Generator',
            schoolName,
            headerStr: JSON.stringify(header, null, 4),
            payloadStr: JSON.stringify(payload, null, 4),
            jwt: token,
            sso_link
        });
    } catch (e) {
        console.error('SSO Generator error:', e);
        res.status(500).send('Fehler beim Generieren des Test-Tokens.');
    }
});

router.jwtConfig = jwtConfig;
module.exports = router;
