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

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

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

// Core Routers Binding
const authRouter = require('./routes/auth');
const bookingsRouter = require('./routes/bookings');
const adminRouter = require('./routes/admin');

app.use('/', authRouter);
app.use('/', bookingsRouter);
app.use('/', adminRouter);

// GET / -> redirects to bookings
app.get('/', (req, res) => {
    res.redirect('/bookings');
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
