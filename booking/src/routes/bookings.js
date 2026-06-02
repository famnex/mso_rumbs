const express = require('express');
const router = express.Router();
const { dbQuery } = require('../db');

// Middleware to ensure user is logged in
function requireLogin(req, res, next) {
    if (!req.session.userId) {
        if (req.path !== '/' && req.path !== '/dashboard' && req.path !== '/bookings') {
            req.session.error = 'Sie müssen eingeloggt sein, um diese Seite zu sehen.';
        }
        return res.redirect('/login');
    }
    next();
}

// GET /dashboard (User Dashboard - Redirected to Bookings Calendar)
router.get('/dashboard', requireLogin, (req, res) => {
    res.redirect('/bookings');
});

// GET /bookings (Wochenplaner Grid Calendar)
router.get('/bookings', requireLogin, async (req, res) => {
    let roomId = req.query.room_id;
    let selectedDate = req.query.date; // Expect YYYY-MM-DD
    
    if (!roomId) {
        try {
            const firstRoom = await dbQuery.get("SELECT room_id FROM rooms WHERE bookable = 1 ORDER BY name ASC LIMIT 1;");
            if (firstRoom) {
                return res.redirect(`/bookings?room_id=${firstRoom.room_id}${selectedDate ? '&date=' + selectedDate : ''}`);
            } else {
                return res.status(500).send('Keine buchbaren Räume im System vorhanden.');
            }
        } catch (e) {
            console.error('Error finding first room:', e);
            return res.status(500).send('Interner Serverfehler.');
        }
    }

    if (!selectedDate) {
        selectedDate = new Date().toISOString().split('T')[0];
    }

    try {
        const room = await dbQuery.get(`
            SELECT r.*, d.name as department_name 
            FROM rooms r 
            LEFT JOIN departments d ON r.department_id = d.department_id 
            WHERE r.room_id = ?;
        `, [roomId]);
        if (!room) {
            req.session.error = 'Der ausgewählte Raum existiert nicht.';
            return res.redirect('/bookings');
        }

        // Fetch all rooms for the selection dropdown
        const allRooms = await dbQuery.all("SELECT * FROM rooms WHERE bookable = 1 ORDER BY name ASC;");

        // Fetch all periods
        const periods = await dbQuery.all("SELECT * FROM periods ORDER BY time_start ASC;");

        // Fetch all weeks (A/B-Wochen)
        const weeks = await dbQuery.all("SELECT * FROM weeks ORDER BY name ASC;");

        // Calculate the Monday to Friday dates of the selected date's week
        const curr = new Date(selectedDate);
        const day = curr.getDay(); // 0 is Sunday, 1 is Monday
        const mondayOffset = day === 0 ? -6 : 1 - day; // Adjust if Sunday
        
        const monday = new Date(curr.setDate(curr.getDate() + mondayOffset));
        
        const weekDates = [];
        const weekDaysNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
        for (let i = 0; i < 5; i++) {
            const tempDate = new Date(monday);
            tempDate.setDate(monday.getDate() + i);
            weekDates.push(tempDate.toISOString().split('T')[0]);
        }

        // Find if this monday is assigned to a week type (A-Woche / B-Woche)
        const mondayStrDate = monday.toISOString().split('T')[0];
        const weekMap = await dbQuery.get("SELECT week_id FROM weekdates WHERE date = ?", [mondayStrDate]);
        const currentWeekId = weekMap ? weekMap.week_id : null;
        
        let weekName = '';
        if (currentWeekId) {
            const wk = await dbQuery.get("SELECT name FROM weeks WHERE week_id = ?", [currentWeekId]);
            if (wk) weekName = wk.name;
        }

        // Pre-fetch bookings for this room in this week
        const bookingRows = await dbQuery.all(
            `SELECT b.*, u.displayname, u.username, u.firstname, u.lastname
             FROM bookings b
             LEFT JOIN users u ON b.user_id = u.user_id
             WHERE b.room_id = ? AND b.cancelled = 0 AND (b.date IN (?, ?, ?, ?, ?) OR b.date IS NULL)`,
            [roomId, ...weekDates]
        );

        // Map bookings into a fast lookup grid cache: date_period or dayNum_period (for timetable lessons)
        const gridBookings = {};
        for (const b of bookingRows) {
            if (b.date) {
                // Specific single date booking
                gridBookings[`${b.date}_${b.period_id}`] = b;
            } else if (b.day_num !== null) {
                // Timetabled recurring lesson (e.g. A/B week)
                // Display it only if it fits the current week type (A/B) OR applies to every week (week_id is null or 0)
                if (!b.week_id || b.week_id == currentWeekId) {
                    gridBookings[`day_${b.day_num}_${b.period_id}`] = b;
                }
            }
        }

        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        // Calculate next / prev week dates for navigation
        const prevWeekDate = new Date(monday);
        prevWeekDate.setDate(monday.getDate() - 7);
        const nextWeekDate = new Date(monday);
        nextWeekDate.setDate(monday.getDate() + 7);

        // Fetch all holidays and construct a holiday map for the 5 week dates
        const holidays = await dbQuery.all("SELECT * FROM holidays;");
        const holidayMap = {};
        for (const dateStr of weekDates) {
            const targetTime = new Date(dateStr).getTime();
            const matchingHoliday = holidays.find(h => {
                const start = new Date(h.date_start).getTime();
                const end = new Date(h.date_end).getTime();
                return targetTime >= start && targetTime <= end;
            });
            holidayMap[dateStr] = matchingHoliday ? matchingHoliday.name : null;
        }

        res.render('bookings', {
            title: 'Belegungsplan',
            schoolName,
            displayName: req.session.displayName,
            authlevel: req.session.authlevel,
            currentUserId: req.session.userId,
            room,
            allRooms,
            periods,
            weeks,
            weekDates,
            weekDaysNames,
            selectedDate,
            mondayStr: monday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            weekName,
            prevWeek: prevWeekDate.toISOString().split('T')[0],
            nextWeek: nextWeekDate.toISOString().split('T')[0],
            gridBookings,
            holidayMap,
            loadBookingScript: true,
            error: req.session.error || null,
            success: req.session.success || null
        });
        // Clear flash values
        req.session.error = null;
        req.session.success = null;

    } catch (e) {
        console.error('Bookings load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// POST /bookings/add (Dynamic Grid Booking / Quick Booking & Timetable Blockings)
router.post('/bookings/add', requireLogin, async (req, res) => {
    const { room_id, period_id, date, notes, booking_type, week_id } = req.body;

    if (!room_id || !period_id || !date) {
        req.session.error = 'Unvollständige Buchungsdaten.';
        return res.redirect('/bookings');
    }

    try {
        // Block single bookings on holidays
        if (booking_type !== 'timetable') {
            const holidays = await dbQuery.all("SELECT * FROM holidays;");
            const targetTime = new Date(date).getTime();
            const matchingHoliday = holidays.find(h => {
                const start = new Date(h.date_start).getTime();
                const end = new Date(h.date_end).getTime();
                return targetTime >= start && targetTime <= end;
            });
            if (matchingHoliday) {
                req.session.error = `An diesem Datum sind Ferien (${matchingHoliday.name})! Reservierungen sind nicht möglich.`;
                return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
            }
        }

        if (booking_type === 'timetable' && req.session.authlevel === 1) {
            // Permanent timetable block
            const parts = date.split('-');
            const parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            const day_num = parsedDate.getDay(); // 1 = Monday, ..., 5 = Friday

            // Check if there's already a timetable block for this day, period, and week rotation
            let existing;
            const targetWeekId = week_id ? parseInt(week_id) : null;
            
            if (targetWeekId) {
                existing = await dbQuery.get(
                    "SELECT * FROM bookings WHERE room_id = ? AND period_id = ? AND day_num = ? AND (week_id = ? OR week_id IS NULL) AND date IS NULL AND cancelled = 0",
                    [room_id, period_id, day_num, targetWeekId]
                );
            } else {
                existing = await dbQuery.get(
                    "SELECT * FROM bookings WHERE room_id = ? AND period_id = ? AND day_num = ? AND date IS NULL AND cancelled = 0",
                    [room_id, period_id, day_num]
                );
            }

            if (existing) {
                req.session.error = 'Dieser Slot ist in der ausgewählten Stunde bereits durch einen Stundenplaneintrag belegt!';
                return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
            }

            // Insert new timetabled block
            await dbQuery.run(
                `INSERT INTO bookings (room_id, period_id, user_id, date, notes, cancelled, day_num, week_id) VALUES (?, ?, ?, NULL, ?, 0, ?, ?)`,
                [room_id, period_id, req.session.userId, notes || 'Unterricht', day_num, targetWeekId]
            );

            req.session.success = 'Stundenplanblockierung erfolgreich gespeichert!';
            return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
        } else {
            // Standard single booking
            const existing = await dbQuery.get(
                "SELECT * FROM bookings WHERE room_id = ? AND period_id = ? AND date = ? AND cancelled = 0",
                [room_id, period_id, date]
            );

            if (existing) {
                req.session.error = 'Dieser Raum ist in der ausgewählten Stunde bereits belegt!';
                return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
            }

            // Insert new booking
            await dbQuery.run(
                `INSERT INTO bookings (room_id, period_id, user_id, date, notes, cancelled) VALUES (?, ?, ?, ?, ?, 0)`,
                [room_id, period_id, req.session.userId, date, notes || '']
            );

            req.session.success = 'Raum erfolgreich gebucht!';
            res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
        }

    } catch (e) {
        console.error('Add booking error:', e);
        req.session.error = 'Fehler beim Speichern der Buchung.';
        res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
    }
});

// POST /bookings/cancel (Cancel Dynamic Booking)
router.post('/bookings/cancel', requireLogin, async (req, res) => {
    const { booking_id, room_id, date, redirect_to } = req.body;

    if (!booking_id) {
        req.session.error = 'Ungültige Stornierungsdaten.';
        return res.redirect(redirect_to || '/bookings');
    }

    try {
        const booking = await dbQuery.get("SELECT * FROM bookings WHERE booking_id = ?", [booking_id]);
        if (!booking) {
            req.session.error = 'Die Buchung existiert nicht.';
            return res.redirect(redirect_to || '/bookings');
        }

        // Verify authorization: User can only cancel their own booking, unless they are admin (authlevel = 1)
        if (booking.user_id !== req.session.userId && req.session.authlevel !== 1) {
            req.session.error = 'Sie sind nicht berechtigt, diese Buchung zu stornieren.';
            return res.redirect(redirect_to || `/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);
        }

        // Perform cancellation (cancelled = 1)
        await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE booking_id = ?", [booking_id]);

        req.session.success = 'Buchung erfolgreich storniert!';
        res.redirect(redirect_to || `/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);

    } catch (e) {
        console.error('Cancel booking error:', e);
        req.session.error = 'Fehler beim Stornieren der Buchung.';
        res.redirect(redirect_to || '/bookings');
    }
});

// POST /bookings/edit (Edit existing booking notes - Admin or Owner only)
router.post('/bookings/edit', requireLogin, async (req, res) => {
    const { booking_id, room_id, date, notes } = req.body;
    if (!booking_id) {
        req.session.error = 'Ungültige Buchungs-ID.';
        return res.redirect('/bookings');
    }
    try {
        const booking = await dbQuery.get("SELECT * FROM bookings WHERE booking_id = ?", [booking_id]);
        if (!booking) {
            req.session.error = 'Die Buchung existiert nicht.';
            return res.redirect('/bookings');
        }
        // Verify authorization: User can only edit their own booking, unless they are admin (authlevel = 1)
        if (booking.user_id !== req.session.userId && req.session.authlevel !== 1) {
            req.session.error = 'Sie sind nicht berechtigt, diese Buchung zu bearbeiten.';
            return res.redirect(`/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);
        }
        
        await dbQuery.run("UPDATE bookings SET notes = ? WHERE booking_id = ?", [notes || '', booking_id]);
        req.session.success = 'Buchungsdetails erfolgreich aktualisiert!';
        res.redirect(`/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);
    } catch (e) {
        console.error('Edit booking notes error:', e);
        req.session.error = 'Fehler beim Bearbeiten der Buchung.';
        res.redirect('/bookings');
    }
});

// GET /bookings/my-bookings (View Logged-in User's Bookings - Future / Archive)
router.get('/bookings/my-bookings', requireLogin, async (req, res) => {
    const showArchive = req.query.archive === 'true';
    const today = new Date().toISOString().split('T')[0];

    try {
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        let bookings = [];
        if (showArchive) {
            bookings = await dbQuery.all(`
                SELECT b.*, r.name as room_name, p.name as period_name, p.time_start, p.time_end, w.name as week_name 
                FROM bookings b
                JOIN rooms r ON b.room_id = r.room_id
                JOIN periods p ON b.period_id = p.period_id
                LEFT JOIN weeks w ON b.week_id = w.week_id
                WHERE b.user_id = ? AND b.cancelled = 0 AND b.date < ? AND b.date IS NOT NULL
                ORDER BY b.date DESC, p.time_start DESC;
            `, [req.session.userId, today]);
        } else {
            bookings = await dbQuery.all(`
                SELECT b.*, r.name as room_name, p.name as period_name, p.time_start, p.time_end, w.name as week_name 
                FROM bookings b
                JOIN rooms r ON b.room_id = r.room_id
                JOIN periods p ON b.period_id = p.period_id
                LEFT JOIN weeks w ON b.week_id = w.week_id
                WHERE b.user_id = ? AND b.cancelled = 0 AND (b.date >= ? OR b.date IS NULL)
                ORDER BY b.date ASC, p.time_start ASC, b.day_num ASC;
            `, [req.session.userId, today]);
        }

        res.render('my_bookings', {
            title: 'Meine Buchungen',
            schoolName,
            displayName: req.session.displayName,
            authlevel: req.session.authlevel,
            currentUserId: req.session.userId,
            bookings,
            showArchive,
            error: req.session.error || null,
            success: req.session.success || null
        });

        // Clear session flash
        req.session.error = null;
        req.session.success = null;

    } catch (e) {
        console.error('Error fetching user bookings:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

module.exports = router;
