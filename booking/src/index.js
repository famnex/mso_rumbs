const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Connect and bootstrap database
require('./db');

// Body Parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Middleware
app.use(session({
    secret: 'classroombookings-node-2026-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 2, // 2 Hours
        secure: false, // http only locally
        sameSite: 'lax'
    }
}));

// Middleware to manage and clear flash messages (error/success) cleanly and prevent them from repeating
app.use((req, res, next) => {
    if (!req.session) {
        res.locals.error = null;
        res.locals.success = null;
        return next();
    }

    // 1. Capture flash messages from session
    const sessionError = req.session.error || null;
    const sessionSuccess = req.session.success || null;

    // 2. Clear them in the session immediately to avoid race conditions
    if (req.session.error) req.session.error = null;
    if (req.session.success) req.session.success = null;

    // 3. Override res.render to inject captured flash messages into the options
    const originalRender = res.render;
    res.render = function (view, options, fn) {
        options = options || {};

        if (options.error === undefined || options.error === null) {
            options.error = sessionError;
        }
        if (options.success === undefined || options.success === null) {
            options.success = sessionSuccess;
        }

        // Also globally supply displayName and authlevel for templates if logged in
        if (req.session && req.session.userId) {
            if (options.displayName === undefined) {
                options.displayName = req.session.displayName || req.session.username;
            }
            if (options.authlevel === undefined) {
                options.authlevel = req.session.authlevel;
            }
        } else {
            if (options.displayName === undefined) options.displayName = null;
            if (options.authlevel === undefined) options.authlevel = null;
        }

        originalRender.call(this, view, options, fn);
    };

    // 4. Save the session immediately if we modified it (to ensure cleared state is persistent)
    if (sessionError || sessionSuccess) {
        req.session.save((err) => {
            if (err) console.error('Error saving session in flash middleware:', err);
            next();
        });
    } else {
        next();
    }
});

// Setup EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve Static Files (both root and subpath for fallback robustness)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/booking', express.static(path.join(__dirname, 'public')));

// Database connector imports
const { dbQuery } = require('./db');

// Global Locals Middleware for Logged-In Users (Header dropdowns)
app.use(async (req, res, next) => {
    try {
        if (req.session && req.session.userId) {
            // Fetch all departments/categories
            res.locals.headerCategories = await dbQuery.all("SELECT * FROM departments ORDER BY name ASC;");
            // Fetch all bookable rooms
            res.locals.headerRooms = await dbQuery.all("SELECT * FROM rooms WHERE bookable = 1 ORDER BY name ASC;");
        } else {
            res.locals.headerCategories = [];
            res.locals.headerRooms = [];
        }
        next();
    } catch (e) {
        console.error('Locals middleware error:', e);
        next();
    }
});

// Middleware to dynamically rewrite HTML links and redirects if running under a subpath (e.g. /booking)
app.use((req, res, next) => {
    const basePath = '/booking';

    // 1. Override res.redirect to automatically prepend base path
    const originalRedirect = res.redirect;
    res.redirect = function (url) {
        if (url.startsWith('/') && !url.startsWith(basePath + '/') && url !== basePath) {
            url = basePath + url;
        }
        originalRedirect.call(this, url);
    };

    // 2. Override res.render to rewrite absolute paths in rendered HTML
    const originalRender = res.render;
    res.render = function (view, options, fn) {
        if (typeof fn !== 'function') {
            fn = (err, html) => {
                if (err) return next(err);
                
                // Rewrite absolute links starting with "/" (href, src, action)
                let rewrittenHtml = html;
                rewrittenHtml = rewrittenHtml
                    .replace(/(href|src|action)="\/(?!(booking\/|booking"|booking\?))/g, `$1="${basePath}/`)
                    .replace(/(href|src|action)='\/(?!(booking\/|booking'|booking\?))/g, `$1='${basePath}/`);

                res.send(rewrittenHtml);
            };
        }
        originalRender.call(this, view, options, fn);
    };

    next();
});

// Core Routers Binding
const authRouter = require('./routes/auth');
const bookingsRouter = require('./routes/bookings');
const adminRouter = require('./routes/admin');

// Bind to both / and /booking to ensure 100% proxy compatibility
app.use('/', authRouter);
app.use('/', bookingsRouter);
app.use('/', adminRouter);

app.use('/booking', authRouter);
app.use('/booking', bookingsRouter);
app.use('/booking', adminRouter);

// GET / -> redirects to bookings (and /booking subpath redirect)
app.get('/', (req, res) => {
    res.redirect('/bookings');
});
app.get('/booking', (req, res) => {
    res.redirect('/booking/bookings');
});

// 404 Error handler
app.use((req, res, next) => {
    res.status(404).render('404', {
        title: '404 - Seite nicht gefunden',
        schoolName: 'Raumbelegung MSO',
        displayName: req.session.displayName || null,
        authlevel: req.session.authlevel || null,
        error: null,
        success: null
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Fatal unhandled error:', err);
    res.status(500).send('Ein schwerwiegender interner Serverfehler ist aufgetreten.');
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`===================================================`);
    console.log(` Classroombookings Node.js Rebuild loaded!`);
    console.log(` Running locally on: http://127.0.0.1:${PORT}`);
    console.log(`===================================================`);
});
