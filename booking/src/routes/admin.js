const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');
const bcrypt = require('bcryptjs');
const authRouter = require('./auth');
const fs = require('fs');
const path = require('path');

// Middleware to ensure user is admin
function requireAdmin(req, res, next) {
    if (!req.session.userId || req.session.authlevel !== 1) {
        req.session.error = 'Zugriff verweigert. Nur Administratoren haben Zugriff auf die Systemsteuerung.';
        return res.redirect('/dashboard');
    }
    next();
}

// GET /admin (Admin Control Panel Overview)
router.get('/admin', requireAdmin, async (req, res) => {
    try {
        const roomsCount = await dbQuery.get("SELECT COUNT(*) as count FROM rooms;");
        const periodsCount = await dbQuery.get("SELECT COUNT(*) as count FROM periods;");
        const usersCount = await dbQuery.get("SELECT COUNT(*) as count FROM users;");
        const bookingsCount = await dbQuery.get("SELECT COUNT(*) as count FROM bookings WHERE cancelled = 0;");

        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/overview', {
            title: 'Systemsteuerung',
            schoolName,
            displayName: req.session.displayName,
            stats: {
                rooms: roomsCount.count,
                periods: periodsCount.count,
                users: usersCount.count,
                bookings: bookingsCount.count
            },
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;

    } catch (e) {
        console.error('Admin overview load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// GET /admin/rooms (Rooms Management List)
router.get('/admin/rooms', requireAdmin, async (req, res) => {
    try {
        const rooms = await dbQuery.all(`
            SELECT r.*, d.name as department_name 
            FROM rooms r 
            LEFT JOIN departments d ON r.department_id = d.department_id 
            ORDER BY r.name ASC;
        `);
        const departments = await dbQuery.all("SELECT * FROM departments ORDER BY name ASC;");
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/rooms', {
            title: 'Medien / Räume verwalten',
            schoolName,
            displayName: req.session.displayName,
            rooms,
            departments,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin rooms load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/rooms/add
router.post('/admin/rooms/add', requireAdmin, async (req, res) => {
    const { name, department_id, notes, bookable } = req.body;
    const isBookable = bookable === '1' ? 1 : 0;

    if (!name) {
        req.session.error = 'Der Name ist erforderlich.';
        return res.redirect('/admin/rooms');
    }

    try {
        const deptId = department_id ? parseInt(department_id) : null;
        await dbQuery.run(
            "INSERT INTO rooms (name, department_id, notes, bookable, icon) VALUES (?, ?, ?, ?, 'computer')",
            [name, deptId, notes || '', isBookable]
        );
        req.session.success = `Medium / Raum '${name}' erfolgreich angelegt!`;
        res.redirect('/admin/rooms');
    } catch (e) {
        console.error('Admin add room error:', e);
        req.session.error = 'Fehler beim Anlegen des Objekts.';
        res.redirect('/admin/rooms');
    }
});

// POST /admin/rooms/delete
router.post('/admin/rooms/delete', requireAdmin, async (req, res) => {
    const { room_id } = req.body;

    if (!room_id) {
        req.session.error = 'Ungültige Objekt-ID.';
        return res.redirect('/admin/rooms');
    }

    try {
        await dbQuery.run("DELETE FROM rooms WHERE room_id = ?", [room_id]);
        // Also delete associated bookings for this room so no orphans remain
        await dbQuery.run("DELETE FROM bookings WHERE room_id = ?", [room_id]);

        req.session.success = 'Medium / Raum erfolgreich gelöscht!';
        res.redirect('/admin/rooms');
    } catch (e) {
        console.error('Admin delete room error:', e);
        req.session.error = 'Fehler beim Löschen des Objekts.';
        res.redirect('/admin/rooms');
    }
});

// GET /admin/periods (Stunden verwalten)
router.get('/admin/periods', requireAdmin, async (req, res) => {
    try {
        const periods = await dbQuery.all("SELECT * FROM periods ORDER BY time_start ASC;");
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/periods', {
            title: 'Stunden verwalten',
            schoolName,
            displayName: req.session.displayName,
            periods,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin periods load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/periods/add
router.post('/admin/periods/add', requireAdmin, async (req, res) => {
    const { name, time_start, time_end, bookable, color } = req.body;
    const isBookable = bookable === '1' ? 1 : 0;
    const periodColor = (color && color.trim() !== '') ? color.trim() : null;

    if (!name || !time_start || !time_end) {
        req.session.error = 'Alle Felder sind erforderlich.';
        return res.redirect('/admin/periods');
    }

    try {
        await dbQuery.run(
            "INSERT INTO periods (name, time_start, time_end, days, bookable, color) VALUES (?, ?, ?, 62, ?, ?)",
            [name, time_start, time_end, isBookable, periodColor]
        );
        req.session.success = `Stunde '${name}' erfolgreich angelegt!`;
        res.redirect('/admin/periods');
    } catch (e) {
        console.error('Admin add period error:', e);
        req.session.error = 'Fehler beim Anlegen der Stunde.';
        res.redirect('/admin/periods');
    }
});

// GET /admin/users (Benutzer verwalten)
router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await dbQuery.all("SELECT * FROM users ORDER BY username ASC;");
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/users', {
            title: 'Benutzer verwalten',
            schoolName,
            displayName: req.session.displayName,
            users,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin users load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/users/add
router.post('/admin/users/add', requireAdmin, async (req, res) => {
    const { username, firstname, lastname, email, password, authlevel } = req.body;

    if (!username || !password || !authlevel) {
        req.session.error = 'Username, Passwort und Rolle sind erforderlich.';
        return res.redirect('/admin/users');
    }

    try {
        const existing = await dbQuery.get("SELECT * FROM users WHERE username = ?", [username]);
        if (existing) {
            req.session.error = 'Dieser Benutzername ist bereits vergeben.';
            return res.redirect('/admin/users');
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const displayname = `${firstname} ${lastname}`.trim() || username;

        await dbQuery.run(
            `INSERT INTO users (username, firstname, lastname, email, displayname, password, authlevel, enabled, created) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [username, firstname || '', lastname || '', email || '', displayname, passwordHash, parseInt(authlevel), new Date().toISOString()]
        );

        req.session.success = `Benutzer '${username}' erfolgreich angelegt!`;
        res.redirect('/admin/users');

    } catch (e) {
        console.error('Admin add user error:', e);
        req.session.error = 'Fehler beim Anlegen des Benutzers.';
        res.redirect('/admin/users');
    }
});

// POST /admin/users/toggle
router.post('/admin/users/toggle', requireAdmin, async (req, res) => {
    const { user_id, enabled } = req.body;

    if (!user_id) {
        req.session.error = 'Ungültige Benutzer-ID.';
        return res.redirect('/admin/users');
    }

    try {
        const targetUser = await dbQuery.get("SELECT * FROM users WHERE user_id = ?", [user_id]);
        if (targetUser.username === 'admin' && parseInt(enabled) === 0) {
            req.session.error = 'Der Haupt-Administrator darf nicht deaktiviert werden!';
            return res.redirect('/admin/users');
        }

        await dbQuery.run("UPDATE users SET enabled = ? WHERE user_id = ?", [parseInt(enabled), user_id]);
        req.session.success = 'Benutzerstatus erfolgreich geändert!';
        res.redirect('/admin/users');
    } catch (e) {
        console.error('Admin toggle user status error:', e);
        req.session.error = 'Fehler beim Ändern des Benutzerstatus.';
        res.redirect('/admin/users');
    }
});

// ==========================================
// 5. HOLIDAYS MANAGEMENT (SCHULFERIEN)
// ==========================================

// GET /admin/holidays
router.get('/admin/holidays', requireAdmin, async (req, res) => {
    try {
        const holidays = await dbQuery.all("SELECT * FROM holidays ORDER BY date_start ASC;");
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/holidays', {
            title: 'Schulferien verwalten',
            schoolName,
            displayName: req.session.displayName,
            holidays,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin holidays load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/holidays/add
router.post('/admin/holidays/add', requireAdmin, async (req, res) => {
    const { name, date_start, date_end } = req.body;
    if (!name || !date_start || !date_end) {
        req.session.error = 'Alle Felder sind erforderlich.';
        return res.redirect('/admin/holidays');
    }
    try {
        await dbQuery.run("INSERT INTO holidays (name, date_start, date_end) VALUES (?, ?, ?)", [name, date_start, date_end]);
        req.session.success = `Ferienzeitraum '${name}' erfolgreich angelegt!`;
        res.redirect('/admin/holidays');
    } catch (e) {
        console.error('Admin add holiday error:', e);
        req.session.error = 'Fehler beim Anlegen des Ferienzeitraums.';
        res.redirect('/admin/holidays');
    }
});

// POST /admin/holidays/delete
router.post('/admin/holidays/delete', requireAdmin, async (req, res) => {
    const { holiday_id } = req.body;
    if (!holiday_id) {
        req.session.error = 'Ungültiger Ferienzeitraum.';
        return res.redirect('/admin/holidays');
    }
    try {
        await dbQuery.run("DELETE FROM holidays WHERE holiday_id = ?", [holiday_id]);
        req.session.success = 'Ferienzeitraum erfolgreich gelöscht!';
        res.redirect('/admin/holidays');
    } catch (e) {
        console.error('Admin delete holiday error:', e);
        req.session.error = 'Fehler beim Löschen des Ferienzeitraums.';
        res.redirect('/admin/holidays');
    }
});

// ==========================================
// 6. CATEGORIES / DEPARTMENTS MANAGEMENT
// ==========================================

// GET /admin/departments
router.get('/admin/departments', requireAdmin, async (req, res) => {
    try {
        const departments = await dbQuery.all("SELECT * FROM departments ORDER BY name ASC;");
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        // Fetch system-wide default category setting
        const defaultCatSetting = await dbQuery.get("SELECT value FROM settings WHERE name='default_category_id' LIMIT 1;");
        const systemDefaultCategoryId = (defaultCatSetting && defaultCatSetting.value) ? parseInt(defaultCatSetting.value) : null;

        res.render('admin/departments', {
            title: 'Kategorien verwalten',
            schoolName,
            displayName: req.session.displayName,
            departments,
            systemDefaultCategoryId,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin departments load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/departments/add
router.post('/admin/departments/add', requireAdmin, async (req, res) => {
    const { name, description, icon } = req.body;
    if (!name) {
        req.session.error = 'Der Name der Kategorie ist erforderlich.';
        return res.redirect('/admin/departments');
    }
    try {
        await dbQuery.run("INSERT INTO departments (name, description, icon) VALUES (?, ?, ?)", [name, description || '', icon || 'general']);
        req.session.success = `Kategorie '${name}' erfolgreich angelegt!`;
        res.redirect('/admin/departments');
    } catch (e) {
        console.error('Admin add department error:', e);
        req.session.error = 'Fehler beim Anlegen der Kategorie.';
        res.redirect('/admin/departments');
    }
});

// POST /admin/departments/delete
router.post('/admin/departments/delete', requireAdmin, async (req, res) => {
    const { department_id } = req.body;
    if (!department_id) {
        req.session.error = 'Ungültige Kategorie.';
        return res.redirect('/admin/departments');
    }
    try {
        await dbQuery.run("DELETE FROM departments WHERE department_id = ?", [department_id]);
        req.session.success = 'Kategorie erfolgreich gelöscht!';
        res.redirect('/admin/departments');
    } catch (e) {
        console.error('Admin delete department error:', e);
        req.session.error = 'Fehler beim Löschen der Kategorie.';
        res.redirect('/admin/departments');
    }
});

// ==========================================
// 7. TIMETABLES / RECURRING SCHEDULING
// ==========================================

// GET /admin/timetables
router.get('/admin/timetables', requireAdmin, async (req, res) => {
    try {
        const timetables = await dbQuery.all(
            `SELECT b.*, r.name as room_name, p.name as period_name, w.name as week_name, w.bgcol as week_bg, w.fgcol as week_fg 
             FROM bookings b 
             JOIN rooms r ON b.room_id = r.room_id 
             JOIN periods p ON b.period_id = p.period_id 
             LEFT JOIN weeks w ON b.week_id = w.week_id 
             WHERE b.date IS NULL AND b.cancelled = 0 
             ORDER BY r.name ASC, b.day_num ASC, p.time_start ASC;`
        );
        const rooms = await dbQuery.all(`
            SELECT r.*, d.name as department_name 
            FROM rooms r 
            LEFT JOIN departments d ON r.department_id = d.department_id 
            ORDER BY r.name ASC;
        `);
        const periods = await dbQuery.all("SELECT * FROM periods ORDER BY time_start ASC;");
        const weeks = await dbQuery.all("SELECT * FROM weeks ORDER BY week_id ASC;");

        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/timetables', {
            title: 'Stundenpläne verwalten',
            schoolName,
            displayName: req.session.displayName,
            timetables,
            rooms,
            periods,
            weeks,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin timetables load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/timetables/add
router.post('/admin/timetables/add', requireAdmin, async (req, res) => {
    const { room_id, period_id, day_num, week_id, notes, overwrite } = req.body;
    if (!room_id || !period_id || !day_num || !notes) {
        req.session.error = 'Unvollständige Stundenplandaten.';
        return res.redirect('/admin/timetables');
    }
    try {
        const parsedWeekId = week_id ? parseInt(week_id) : null;
        const parsedRoomId = parseInt(room_id);
        const parsedPeriodId = parseInt(period_id);
        const parsedDayNum = parseInt(day_num);
        const isOverwrite = overwrite === '1';

        // Check for collision
        let existing;
        if (parsedWeekId) {
            existing = await dbQuery.get(
                `SELECT b.*, u.displayname, u.username, w.name as week_name
                 FROM bookings b
                 LEFT JOIN users u ON b.user_id = u.user_id
                 LEFT JOIN weeks w ON b.week_id = w.week_id
                 WHERE b.room_id = ? AND b.period_id = ? AND b.day_num = ? AND (b.week_id = ? OR b.week_id IS NULL) AND b.date IS NULL AND b.cancelled = 0`,
                [parsedRoomId, parsedPeriodId, parsedDayNum, parsedWeekId]
            );
        } else {
            existing = await dbQuery.get(
                `SELECT b.*, u.displayname, u.username, w.name as week_name
                 FROM bookings b
                 LEFT JOIN users u ON b.user_id = u.user_id
                 LEFT JOIN weeks w ON b.week_id = w.week_id
                 WHERE b.room_id = ? AND b.period_id = ? AND b.day_num = ? AND b.date IS NULL AND b.cancelled = 0`,
                [parsedRoomId, parsedPeriodId, parsedDayNum]
            );
        }

        if (existing) {
            if (isOverwrite) {
                await dbQuery.run("DELETE FROM bookings WHERE booking_id = ?", [existing.booking_id]);
            } else {
                const userName = existing.displayname || existing.username || 'Unbekannt';
                const turnusInfo = existing.week_name ? `Turnus: ${existing.week_name}` : 'Turnus: Jede Woche';
                const noteInfo = existing.notes ? ` (Notiz: "${existing.notes}")` : '';
                req.session.error = `Kollision: Dieser Slot ist an diesem Wochentag bereits belegt von ${userName}${noteInfo} [${turnusInfo}]! Setzen Sie den Haken bei "Kollisionen überschreiben", um ihn zu ersetzen.`;
                return res.redirect('/admin/timetables');
            }
        }

        await dbQuery.run(
            `INSERT INTO bookings (day_num, week_id, room_id, period_id, user_id, date, notes, cancelled) 
             VALUES (?, ?, ?, ?, ?, NULL, ?, 0)`,
            [parsedDayNum, parsedWeekId, parsedRoomId, parsedPeriodId, req.session.userId, notes]
        );
        req.session.success = isOverwrite ? 'Dauerbelegung gespeichert und bestehende Kollision überschrieben!' : 'Wiederkehrende Belegung (Dauerbuchung) erfolgreich angelegt!';
        res.redirect('/admin/timetables');
    } catch (e) {
        console.error('Admin add timetable error:', e);
        req.session.error = 'Fehler beim Anlegen der Dauerbuchung.';
        res.redirect('/admin/timetables');
    }
});

// POST /admin/timetables/delete
router.post('/admin/timetables/delete', requireAdmin, async (req, res) => {
    const { booking_id, redirect_to } = req.body;
    if (!booking_id) {
        req.session.error = 'Ungültige Dauerbuchung.';
        return res.redirect(redirect_to || '/admin/timetables');
    }
    try {
        await dbQuery.run("DELETE FROM bookings WHERE booking_id = ?", [booking_id]);
        req.session.success = 'Dauerbelegung erfolgreich gelöscht!';
        res.redirect(redirect_to || '/admin/timetables');
    } catch (e) {
        console.error('Admin delete timetable error:', e);
        req.session.error = 'Fehler beim Löschen der Dauerbelegung.';
        res.redirect(redirect_to || '/admin/timetables');
    }
});

// ==========================================
function calculateAcademicYearMondays(dateStartStr, dateEndStr) {
    const mondays = [];
    if (!dateStartStr || !dateEndStr) return mondays;

    const sParts = dateStartStr.split('-').map(Number);
    const eParts = dateEndStr.split('-').map(Number);
    if (sParts.length !== 3 || eParts.length !== 3) return mondays;

    let curr = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2]));
    const end = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2]));

    // Shift to first Monday (getUTCDay(): 0 is Sunday, 1 is Monday)
    while (curr.getUTCDay() !== 1) {
        curr.setUTCDate(curr.getUTCDate() + 1);
    }

    while (curr <= end) {
        mondays.push(curr.toISOString().split('T')[0]);
        curr.setUTCDate(curr.getUTCDate() + 7);
    }

    return mondays;
}

// GET /admin/weeks
router.get('/admin/weeks', requireAdmin, async (req, res) => {
    try {
        const academicyear = await dbQuery.get("SELECT * FROM academicyears LIMIT 1;");
        const weeks = await dbQuery.all("SELECT * FROM weeks ORDER BY week_id ASC;");
        
        // Calculate all mondays in academic year using shared UTC helper
        const mondays = academicyear ? calculateAcademicYearMondays(academicyear.date_start, academicyear.date_end) : [];

        // Fetch all mapped dates
        const mappedRows = await dbQuery.all("SELECT * FROM weekdates;");
        const mappedWeeks = {};
        for (const row of mappedRows) {
            mappedWeeks[row.date] = row.week_id;
        }

        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/weeks', {
            title: 'Wochen und Jahresplan',
            schoolName,
            displayName: req.session.displayName,
            academicyear,
            weeks,
            mondays,
            mappedWeeks,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin weeks load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/weeks/academicyear
router.post('/admin/weeks/academicyear', requireAdmin, async (req, res) => {
    const { date_start, date_end } = req.body;
    if (!date_start || !date_end) {
        req.session.error = 'Grenzdaten erforderlich.';
        return res.redirect('/admin/weeks');
    }
    try {
        await dbQuery.run("DELETE FROM academicyears;");
        await dbQuery.run("INSERT INTO academicyears (date_start, date_end) VALUES (?, ?)", [date_start, date_end]);
        req.session.success = 'Schuljahresgrenzen erfolgreich aktualisiert!';
        res.redirect('/admin/weeks');
    } catch (e) {
        console.error('Admin save academicyear error:', e);
        req.session.error = 'Fehler beim Speichern des Jahresplans.';
        res.redirect('/admin/weeks');
    }
});

// POST /admin/weeks/add
router.post('/admin/weeks/add', requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) {
        req.session.error = 'Name des Wochentyps erforderlich.';
        return res.redirect('/admin/weeks');
    }
    try {
        // Find next ID
        const nextIdRow = await dbQuery.get("SELECT MAX(week_id) as max FROM weeks;");
        const nextId = nextIdRow && nextIdRow.max ? nextIdRow.max + 1 : 1;
        
        // Define high-end color templates for rotation weeks
        const colors = [
            { bg: '2563EB', fg: 'FFFFFF' }, // Blue
            { bg: '10B981', fg: 'FFFFFF' }, // Green
            { bg: 'F59E0B', fg: 'FFFFFF' }, // Amber
            { bg: 'EF4444', fg: 'FFFFFF' }  // Red
        ];
        const selectedColor = colors[(nextId - 1) % colors.length];

        await dbQuery.run(
            "INSERT INTO weeks (week_id, name, fgcol, bgcol, icon) VALUES (?, ?, ?, ?, 'calendar')", 
            [nextId, name, selectedColor.fg, selectedColor.bg]
        );
        req.session.success = `Wochentyp '${name}' erfolgreich angelegt!`;
        res.redirect('/admin/weeks');
    } catch (e) {
        console.error('Admin add week type error:', e);
        req.session.error = 'Fehler beim Anlegen des Wochentyps.';
        res.redirect('/admin/weeks');
    }
});

// POST /admin/weeks/assign (Instant mapping select menu with AJAX support)
router.post('/admin/weeks/assign', requireAdmin, async (req, res) => {
    const { date, week_id } = req.body;
    const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!date) {
        if (isAjax) return res.status(400).json({ success: false, error: 'Datum erforderlich.' });
        req.session.error = 'Datum erforderlich.';
        return res.redirect('/admin/weeks');
    }
    try {
        // delete current assignment
        await dbQuery.run("DELETE FROM weekdates WHERE date = ?", [date]);
        
        if (week_id) {
            await dbQuery.run("INSERT INTO weekdates (week_id, date) VALUES (?, ?)", [parseInt(week_id), date]);
        }
        
        if (isAjax) {
            return res.json({ success: true, message: 'Wochenzuordnung gespeichert.' });
        }

        req.session.success = `Wochenzuordnung für Montag (${new Date(date).toLocaleDateString('de-DE')}) erfolgreich aktualisiert!`;
        res.redirect('/admin/weeks');
    } catch (e) {
        console.error('Admin assign week error:', e);
        if (isAjax) return res.status(500).json({ success: false, error: e.message || 'Fehler beim Speichern' });
        req.session.error = 'Fehler beim Speichern der Wochenzuordnung.';
        res.redirect('/admin/weeks');
    }
});

// POST /admin/weeks/autoassign (Bulk auto-assign alternating week types for the entire academic year)
router.post('/admin/weeks/autoassign', requireAdmin, async (req, res) => {
    const { week_id_1, week_id_2 } = req.body;
    if (!week_id_1 || !week_id_2) {
        req.session.error = 'Bitte wählen Sie zwei Wochentypen für die Abwechslung aus.';
        return res.redirect('/admin/weeks');
    }

    try {
        const academicyear = await dbQuery.get("SELECT * FROM academicyears LIMIT 1;");
        if (!academicyear || !academicyear.date_start || !academicyear.date_end) {
            req.session.error = 'Legen Sie zuerst ein Schuljahr mit Start- und Enddatum fest.';
            return res.redirect('/admin/weeks');
        }

        // Calculate all Mondays between date_start and date_end using shared UTC helper
        const mondays = calculateAcademicYearMondays(academicyear.date_start, academicyear.date_end);

        const id1 = parseInt(week_id_1);
        const id2 = parseInt(week_id_2);

        for (let i = 0; i < mondays.length; i++) {
            const mDate = mondays[i];
            const assignedWeekId = (i % 2 === 0) ? id1 : id2;
            
            await dbQuery.run("DELETE FROM weekdates WHERE date = ?", [mDate]);
            await dbQuery.run("INSERT INTO weekdates (week_id, date) VALUES (?, ?)", [assignedWeekId, mDate]);
        }

        req.session.success = `Erfolgreich ${mondays.length} Wochen des Schuljahres abwechselnd belegt!`;
        res.redirect('/admin/weeks');
    } catch (e) {
        console.error('Auto assign error:', e);
        req.session.error = 'Fehler bei der automatischen Wochenzuweisung: ' + (e.message || e);
        res.redirect('/admin/weeks');
    }
});

// ==========================================
// CRUD EDIT & DELETE ENDPOINTS
// ==========================================

// POST /admin/rooms/edit
router.post('/admin/rooms/edit', requireAdmin, async (req, res) => {
    const { room_id, name, department_id, notes, bookable } = req.body;
    const isBookable = bookable === '1' ? 1 : 0;
    if (!room_id || !name) {
        req.session.error = 'Objekt-ID und Name sind erforderlich.';
        return res.redirect('/admin/rooms');
    }
    try {
        const deptId = department_id ? parseInt(department_id) : null;
        await dbQuery.run(
            "UPDATE rooms SET name = ?, department_id = ?, notes = ?, bookable = ? WHERE room_id = ?",
            [name, deptId, notes || '', isBookable, parseInt(room_id)]
        );
        req.session.success = `Medium / Raum '${name}' erfolgreich aktualisiert!`;
        res.redirect('/admin/rooms');
    } catch (e) {
        console.error('Admin edit room error:', e);
        req.session.error = 'Fehler beim Aktualisieren des Objekts.';
        res.redirect('/admin/rooms');
    }
});

// POST /admin/periods/edit
router.post('/admin/periods/edit', requireAdmin, async (req, res) => {
    const { period_id, name, time_start, time_end, bookable, color } = req.body;
    const isBookable = bookable === '1' ? 1 : 0;
    const periodColor = (color && color.trim() !== '') ? color.trim() : null;

    if (!period_id || !name || !time_start || !time_end) {
        req.session.error = 'Alle Felder sind erforderlich.';
        return res.redirect('/admin/periods');
    }
    try {
        await dbQuery.run(
            "UPDATE periods SET name = ?, time_start = ?, time_end = ?, bookable = ?, color = ? WHERE period_id = ?",
            [name, time_start, time_end, isBookable, periodColor, parseInt(period_id)]
        );
        req.session.success = `Stunde '${name}' erfolgreich aktualisiert!`;
        res.redirect('/admin/periods');
    } catch (e) {
        console.error('Admin edit period error:', e);
        req.session.error = 'Fehler beim Aktualisieren der Stunde.';
        res.redirect('/admin/periods');
    }
});

// POST /admin/periods/delete
router.post('/admin/periods/delete', requireAdmin, async (req, res) => {
    const { period_id } = req.body;
    if (!period_id) {
        req.session.error = 'Ungültige Stunde.';
        return res.redirect('/admin/periods');
    }
    try {
        const period = await dbQuery.get("SELECT name FROM periods WHERE period_id = ?", [period_id]);
        const periodName = period ? period.name : '';
        await dbQuery.run("DELETE FROM periods WHERE period_id = ?", [parseInt(period_id)]);
        // Cancel future bookings in this period
        await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE period_id = ?", [parseInt(period_id)]);
        req.session.success = `Unterrichtsstunde '${periodName}' und zugehörige Buchungen erfolgreich gelöscht!`;
        res.redirect('/admin/periods');
    } catch (e) {
        console.error('Admin delete period error:', e);
        req.session.error = 'Fehler beim Löschen der Stunde.';
        res.redirect('/admin/periods');
    }
});

// POST /admin/departments/edit
router.post('/admin/departments/edit', requireAdmin, async (req, res) => {
    const { department_id, name, description, icon } = req.body;
    if (!department_id || !name) {
        req.session.error = 'Kategorie-ID und Name sind erforderlich.';
        return res.redirect('/admin/departments');
    }
    try {
        await dbQuery.run(
            "UPDATE departments SET name = ?, description = ?, icon = ? WHERE department_id = ?",
            [name, description || '', icon || 'general', parseInt(department_id)]
        );
        req.session.success = `Kategorie '${name}' erfolgreich aktualisiert!`;
        res.redirect('/admin/departments');
    } catch (e) {
        console.error('Admin edit department error:', e);
        req.session.error = 'Fehler beim Aktualisieren der Kategorie.';
        res.redirect('/admin/departments');
    }
});

// POST /admin/holidays/edit
router.post('/admin/holidays/edit', requireAdmin, async (req, res) => {
    const { holiday_id, name, date_start, date_end } = req.body;
    if (!holiday_id || !name || !date_start || !date_end) {
        req.session.error = 'Alle Felder sind erforderlich.';
        return res.redirect('/admin/holidays');
    }
    try {
        await dbQuery.run(
            "UPDATE holidays SET name = ?, date_start = ?, date_end = ? WHERE holiday_id = ?",
            [name, date_start, date_end, parseInt(holiday_id)]
        );
        req.session.success = `Ferienzeitraum '${name}' erfolgreich aktualisiert!`;
        res.redirect('/admin/holidays');
    } catch (e) {
        console.error('Admin edit holiday error:', e);
        req.session.error = 'Fehler beim Aktualisieren des Ferienzeitraums.';
        res.redirect('/admin/holidays');
    }
});

// POST /admin/users/edit
router.post('/admin/users/edit', requireAdmin, async (req, res) => {
    const { user_id, username, firstname, lastname, email, password, authlevel } = req.body;
    if (!user_id || !username || !authlevel) {
        req.session.error = 'Benutzer-ID, Username und Berechtigungsstufe sind erforderlich.';
        return res.redirect('/admin/users');
    }
    try {
        const parsedAuth = parseInt(authlevel);
        const displayname = `${firstname} ${lastname}`.trim() || username;
        
        if (password && password.trim().length > 0) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            await dbQuery.run(
                `UPDATE users SET username = ?, firstname = ?, lastname = ?, email = ?, displayname = ?, password = ?, authlevel = ? 
                 WHERE user_id = ?`,
                [username, firstname || '', lastname || '', email || '', displayname, passwordHash, parsedAuth, parseInt(user_id)]
            );
        } else {
            await dbQuery.run(
                `UPDATE users SET username = ?, firstname = ?, lastname = ?, email = ?, displayname = ?, authlevel = ? 
                 WHERE user_id = ?`,
                [username, firstname || '', lastname || '', email || '', displayname, parsedAuth, parseInt(user_id)]
            );
        }
        req.session.success = `Benutzerkonto '${username}' erfolgreich aktualisiert!`;
        res.redirect('/admin/users');
    } catch (e) {
        console.error('Admin edit user error:', e);
        req.session.error = 'Fehler beim Aktualisieren des Benutzers.';
        res.redirect('/admin/users');
    }
});

// POST /admin/users/delete
router.post('/admin/users/delete', requireAdmin, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        req.session.error = 'Ungültige Benutzer-ID.';
        return res.redirect('/admin/users');
    }
    try {
        const targetUser = await dbQuery.get("SELECT * FROM users WHERE user_id = ?", [user_id]);
        if (targetUser && targetUser.username === 'admin') {
            req.session.error = 'Der Haupt-Administrator darf nicht gelöscht werden!';
            return res.redirect('/admin/users');
        }
        const username = targetUser ? targetUser.username : '';
        await dbQuery.run("DELETE FROM users WHERE user_id = ?", [parseInt(user_id)]);
        req.session.success = `Benutzerkonto '${username}' erfolgreich gelöscht!`;
        res.redirect('/admin/users');
    } catch (e) {
        console.error('Admin delete user error:', e);
        req.session.error = 'Fehler beim Löschen des Benutzers.';
        res.redirect('/admin/users');
    }
});

// POST /admin/timetables/edit
router.post('/admin/timetables/edit', requireAdmin, async (req, res) => {
    const { booking_id, room_id, period_id, day_num, week_id, notes, redirect_to } = req.body;
    if (!booking_id || !room_id || !period_id || !day_num || !notes) {
        req.session.error = 'Unvollständige Dauerbelegungsdaten.';
        return res.redirect(redirect_to || '/admin/timetables');
    }
    try {
        const parsedWeekId = week_id ? parseInt(week_id) : null;
        await dbQuery.run(
            `UPDATE bookings SET room_id = ?, period_id = ?, day_num = ?, week_id = ?, notes = ? 
             WHERE booking_id = ?`,
            [parseInt(room_id), parseInt(period_id), parseInt(day_num), parsedWeekId, notes, parseInt(booking_id)]
        );
        req.session.success = 'Stundenplaneintrag erfolgreich aktualisiert!';
        res.redirect(redirect_to || '/admin/timetables');
    } catch (e) {
        console.error('Admin edit timetable error:', e);
        req.session.error = 'Fehler beim Aktualisieren der Dauerbelegung.';
        res.redirect(redirect_to || '/admin/timetables');
    }
});

// POST /admin/weeks/edit
router.post('/admin/weeks/edit', requireAdmin, async (req, res) => {
    const { week_id, name } = req.body;
    if (!week_id || !name) {
        req.session.error = 'Name des Wochentyps und ID sind erforderlich.';
        return res.redirect('/admin/weeks');
    }
    try {
        await dbQuery.run("UPDATE weeks SET name = ? WHERE week_id = ?", [name, parseInt(week_id)]);
        req.session.success = `Wochentyp successfully updated to '${name}'!`;
        res.redirect('/admin/weeks');
    } catch (e) {
        console.error('Admin edit week error:', e);
        req.session.error = 'Fehler beim Aktualisieren des Wochentyps.';
        res.redirect('/admin/weeks');
    }
});

// POST /admin/weeks/delete
router.post('/admin/weeks/delete', requireAdmin, async (req, res) => {
    const { week_id } = req.body;
    if (!week_id) {
        req.session.error = 'Ungültiger Wochentyp.';
        return res.redirect('/admin/weeks');
    }
    try {
        await dbQuery.run("DELETE FROM weeks WHERE week_id = ?", [parseInt(week_id)]);
        // Also remove assignments
        await dbQuery.run("DELETE FROM weekdates WHERE week_id = ?", [parseInt(week_id)]);
        req.session.success = 'Wochentyp erfolgreich gelöscht!';
        res.redirect('/admin/weeks');
    } catch (e) {
        console.error('Admin delete week error:', e);
        req.session.error = 'Fehler beim Löschen des Wochentyps.';
        res.redirect('/admin/weeks');
    }
});

// Helper to sync local/config.php file with new JWT SSO settings
function saveConfigToPhp(config) {
    const configPath = path.join(__dirname, '../../local/config.php');
    if (fs.existsSync(configPath)) {
        try {
            let content = fs.readFileSync(configPath, 'utf8');
            
            // Replace enabled state
            content = content.replace(/'enabled'\s*=>\s*(true|false)/, `'enabled' => ${config.enabled}`);
            
            // Replace secret key
            content = content.replace(/'secret'\s*=>\s*'([^']*)'/, `'secret' => '${config.secret}'`);
            
            // Replace parameter_name
            content = content.replace(/'parameter_name'\s*=>\s*'([^']*)'/, `'parameter_name' => '${config.parameter_name}'`);
            
            // Replace sso_url
            content = content.replace(/'sso_url'\s*=>\s*'([^']*)'/, `'sso_url' => '${config.sso_url}'`);
            
            // Replace auto_create_user state
            content = content.replace(/'auto_create_user'\s*=>\s*(true|false)/, `'auto_create_user' => ${config.auto_create_user}`);
            
            // Replace default_authlevel role
            content = content.replace(/'default_authlevel'\s*=>\s*(\d+)/, `'default_authlevel' => ${config.default_authlevel}`);

            // Replace logout_redirect_url state
            content = content.replace(/'logout_redirect_url'\s*=>\s*'([^']*)'/, `'logout_redirect_url' => '${config.logout_redirect_url}'`);
            
            fs.writeFileSync(configPath, content, 'utf8');
            console.log('JWT SSO config successfully written and synchronized in local/config.php');
        } catch (err) {
            console.error('Error writing config.php:', err);
            throw err;
        }
    }
}

// GET /admin/config (SSO / JWT Configuration Dashboard)
router.get('/admin/config', requireAdmin, async (req, res) => {
    try {
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        // Load active configuration in-memory
        const jwtConfig = authRouter.jwtConfig;

        // Fetch custom logout button text
        const logoutSetting = await dbQuery.get("SELECT value FROM settings WHERE name='logout_button_text' LIMIT 1;");
        const logoutButtonText = logoutSetting ? logoutSetting.value : 'Abmelden';

        res.render('admin/config', {
            title: 'SSO & JWT Konfiguration',
            schoolName,
            displayName: req.session.displayName,
            jwtConfig,
            logoutButtonText,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Admin config load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/config (Save JWT SSO parameters & UI text customizations)
router.post('/admin/config', requireAdmin, async (req, res) => {
    const { enabled, secret, sso_url, parameter_name, auto_create_user, default_authlevel, logout_redirect_url, logout_button_text } = req.body;

    if (!secret || !sso_url) {
        req.session.error = 'JWT Secret und SSO Portal Login-URL sind erforderlich.';
        return res.redirect('/admin/config');
    }

    try {
        const config = {
            enabled: enabled === '1',
            secret: secret.trim(),
            sso_url: sso_url.trim(),
            parameter_name: (parameter_name || 'token').trim(),
            auto_create_user: auto_create_user === '1',
            default_authlevel: parseInt(default_authlevel) || 2,
            logout_redirect_url: (logout_redirect_url || '').trim()
        };

        // 1. Write back to config.php file
        saveConfigToPhp(config);

        // 2. Synchronize active in-memory auth router config objects
        authRouter.jwtConfig.enabled = config.enabled;
        authRouter.jwtConfig.secret = config.secret;
        authRouter.jwtConfig.sso_url = config.sso_url;
        authRouter.jwtConfig.parameter_name = config.parameter_name;
        authRouter.jwtConfig.auto_create_user = config.auto_create_user;
        authRouter.jwtConfig.default_authlevel = config.default_authlevel;
        authRouter.jwtConfig.logout_redirect_url = config.logout_redirect_url;

        // 3. Save custom logout button text setting
        const logoutTextVal = (logout_button_text || 'Abmelden').trim();
        await dbQuery.run(`
            INSERT OR REPLACE INTO settings ("group", name, value)
            VALUES ('crbs', 'logout_button_text', ?);
        `, [logoutTextVal]);

        req.session.success = 'Konfiguration und UI-Einstellungen erfolgreich gespeichert und synchronisiert!';
        res.redirect('/admin/config');
    } catch (e) {
        console.error('Admin save config error:', e);
        req.session.error = 'Fehler beim Speichern der Konfiguration.';
        res.redirect('/admin/config');
    }
});

// GET /admin/update (System Update Interface)
router.get('/admin/update', requireAdmin, async (req, res) => {
    try {
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        // Get current git info safely
        const { execSync } = require('child_process');
        let gitInfo = 'Unbekannt (Git nicht verfügbar)';
        try {
            gitInfo = execSync('git log -n 1 --oneline', { encoding: 'utf8' }).trim();
        } catch (gitErr) {
            console.warn('Git is not available or not initialized:', gitErr.message);
        }

        res.render('admin/update', {
            title: 'Systemaktualisierung',
            schoolName,
            displayName: req.session.displayName,
            gitInfo,
            error: req.session.error || null,
            success: req.session.success || null
        });
        req.session.error = null;
        req.session.success = null;
    } catch (e) {
        console.error('Error loading update view:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /admin/update/run (Executes Git pull, npm install, Syntax validation, and PM2 reload with hash-based safe rollbacks)
router.post('/admin/update/run', requireAdmin, async (req, res) => {
    const { exec, execSync } = require('child_process');
    const logs = [];
    const repoPath = path.join(__dirname, '../..');

    const runCmd = (cmd) => {
        return new Promise((resolve, reject) => {
            logs.push(`> ${cmd}`);
            exec(cmd, { cwd: repoPath }, (error, stdout, stderr) => {
                if (stdout) logs.push(stdout.trim());
                if (stderr) logs.push(stderr.trim());
                if (error) {
                    logs.push(`Befehl fehlgeschlagen mit Exit Code: ${error.code}`);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    };

    let startCommitHash = null;

    try {
        // Record starting commit for reliable rollback
        try {
            startCommitHash = execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
            logs.push(`Ausgangs-Commit: ${startCommitHash.slice(0, 7)}`);
        } catch (hErr) {
            console.warn('Could not determine current commit:', hErr);
        }

        // Step 1: Fetch and Sync from Git
        logs.push('=== Schritt 1/4: Git Repository synchronisieren ===');
        await runCmd('git fetch origin main');

        // Clean unversioned clutter (leaving .gitignored files like local/ intact)
        try {
            await runCmd('git clean -f -d');
        } catch (cErr) {
            // Ignore if clean fails
        }

        // Fast-forward or pull safely to origin/main
        try {
            await runCmd('git pull --ff-only');
        } catch (pullErr) {
            logs.push('> Fallback: Setze Arbeitsverzeichnis auf origin/main zurück...');
            await runCmd('git reset --hard origin/main');
        }

        // Step 2: Install potential new npm packages
        logs.push('\n=== Schritt 2/4: Abhängigkeiten prüfen (npm install) ===');
        await runCmd('npm install');

        // Step 3: Crucial Syntax Verification Check across all key files
        logs.push('\n=== Schritt 3/4: Syntax- & Integritätsprüfung ===');
        try {
            await runCmd('node --check src/index.js');
            await runCmd('node --check src/db.js');
            await runCmd('node --check src/routes/admin.js');
            await runCmd('node --check src/routes/bookings.js');
            await runCmd('node --check src/routes/auth.js');
        } catch (syntaxErr) {
            logs.push('\n[KRITISCHER FEHLER] Syntaxprüfung fehlgeschlagen! Ein Update der Anwendung würde zum Systemabsturz führen.');
            throw new Error('syntax_error');
        }

        // Step 4: All checks passed. Schedule reload
        logs.push('\n=== Schritt 4/4: Bereit zum Neustart ===');
        logs.push('Alle Tests erfolgreich abgeschlossen. PM2 Reload wird in 1,5 Sekunden ausgeführt...');

        setTimeout(() => {
            exec('pm2 reload classroombookings', (reloadErr, reloadStdout, reloadStderr) => {
                if (reloadErr) {
                    console.error('Failed to reload process in PM2:', reloadErr);
                }
            });
        }, 1500);

        return res.json({
            success: true,
            logs: logs.join('\n')
        });

    } catch (err) {
        logs.push('\n=== [ROLLBACK] Starte automatische Systemwiederherstellung ===');
        
        try {
            if (startCommitHash) {
                logs.push(`> Rollback ausführen (git reset --hard ${startCommitHash.slice(0, 7)})...`);
                execSync(`git reset --hard ${startCommitHash}`, { cwd: repoPath });
                logs.push('Git-Repository erfolgreich auf den vorherigen Stand zurückgesetzt.');
            } else {
                logs.push('> Rollback ausführen (git checkout -f)...');
                execSync('git checkout -f', { cwd: repoPath });
            }

            logs.push('> Abhängigkeiten wiederherstellen (npm install)...');
            execSync('npm install', { cwd: repoPath });
            logs.push('Bibliotheken erfolgreich wiederhergestellt.');
            
            logs.push('\n[Wiederhergestellt] Das System wurde erfolgreich auf den funktionierenden Zustand vor dem Update zurückgesetzt. Die Anwendung läuft stabil weiter.');
        } catch (rollbackErr) {
            logs.push(`\n[HINWEIS] Rollback-Meldung: ${rollbackErr.message}`);
        }

        return res.json({
            success: false,
            logs: logs.join('\n')
        });
    }
});

// GET /admin/cleanup (Database Maintenance & Orphan Cleanup)
router.get('/admin/cleanup', requireAdmin, async (req, res) => {
    try {
        const orphanRooms = await dbQuery.all(`
            SELECT b.room_id, COUNT(*) as cnt, MIN(b.date) as min_date, MAX(b.date) as max_date,
                   SUM(CASE WHEN b.date IS NULL AND b.day_num IS NOT NULL THEN 1 ELSE 0 END) as timetable_cnt,
                   SUM(CASE WHEN b.date IS NOT NULL THEN 1 ELSE 0 END) as single_cnt
            FROM bookings b 
            WHERE b.room_id NOT IN (SELECT room_id FROM rooms) OR b.room_id = 0 OR b.room_id IS NULL
            GROUP BY b.room_id
            ORDER BY cnt DESC;
        `);

        const totalOrphanRoomBookings = orphanRooms.reduce((sum, r) => sum + r.cnt, 0);

        const orphanUsers = await dbQuery.all(`
            SELECT b.user_id, COUNT(*) as cnt
            FROM bookings b 
            WHERE b.user_id NOT IN (SELECT user_id FROM users)
            GROUP BY b.user_id;
        `);
        const totalOrphanUserBookings = orphanUsers.reduce((sum, u) => sum + u.cnt, 0);

        const orphanPeriods = await dbQuery.all(`
            SELECT b.period_id, COUNT(*) as cnt
            FROM bookings b 
            WHERE b.period_id NOT IN (SELECT period_id FROM periods)
            GROUP BY b.period_id;
        `);
        const totalOrphanPeriodBookings = orphanPeriods.reduce((sum, p) => sum + p.cnt, 0);

        // Cancelled bookings older than 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const staleCancelled = await dbQuery.get(`
            SELECT COUNT(*) as cnt FROM bookings WHERE cancelled = 1 AND date IS NOT NULL AND date < ?;
        `, [ninetyDaysAgo]);
        const staleCancelledCount = staleCancelled ? staleCancelled.cnt : 0;

        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('admin/db_cleanup', {
            title: 'Datenbank-Bereinigung & Wartung',
            schoolName,
            displayName: req.session.displayName,
            authlevel: req.session.authlevel,
            orphanRooms,
            totalOrphanRoomBookings,
            totalOrphanUserBookings,
            totalOrphanPeriodBookings,
            totalOrphans: totalOrphanRoomBookings + totalOrphanUserBookings + totalOrphanPeriodBookings,
            staleCancelledCount,
            error: req.session.error || null,
            success: req.session.success || null
        });

        req.session.error = null;
        req.session.success = null;

    } catch (e) {
        console.error('Admin cleanup load error:', e);
        res.status(500).send('Interner Serverfehler beim Laden der Bereinigungsseite.');
    }
});

// POST /admin/cleanup (Execute cleanup)
router.post('/admin/cleanup', requireAdmin, async (req, res) => {
    const { action } = req.body;

    try {
        let deletedCount = 0;

        if (action === 'clean_orphans' || action === 'clean_all') {
            const r1 = await dbQuery.run(`
                DELETE FROM bookings 
                WHERE room_id NOT IN (SELECT room_id FROM rooms) OR room_id = 0 OR room_id IS NULL;
            `);
            const r2 = await dbQuery.run(`
                DELETE FROM bookings 
                WHERE user_id NOT IN (SELECT user_id FROM users);
            `);
            const r3 = await dbQuery.run(`
                DELETE FROM bookings 
                WHERE period_id NOT IN (SELECT period_id FROM periods);
            `);
            deletedCount += (r1.changes || 0) + (r2.changes || 0) + (r3.changes || 0);
        }

        if (action === 'clean_cancelled' || action === 'clean_all') {
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const r4 = await dbQuery.run(`
                DELETE FROM bookings WHERE cancelled = 1 AND date IS NOT NULL AND date < ?;
            `, [ninetyDaysAgo]);
            deletedCount += (r4.changes || 0);
        }

        req.session.success = `Erfolgreich ${deletedCount} verwaiste / veraltete Datensätze aus der Datenbank gelöscht!`;
        res.redirect('/admin/cleanup');

    } catch (e) {
        console.error('Admin cleanup execution error:', e);
        req.session.error = 'Fehler bei der Datenbank-Bereinigung: ' + (e.message || e);
        res.redirect('/admin/cleanup');
    }
});

module.exports = router;
