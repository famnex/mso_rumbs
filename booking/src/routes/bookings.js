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

// Helper function to load all calendar data for both logged-in and public read-only views
async function fetchBookingCalendarData(req, roomId, selectedDate) {
    if (!selectedDate) {
        selectedDate = new Date().toISOString().split('T')[0];
    }

    if (!roomId) {
        const defaultCatSetting = await dbQuery.get("SELECT value FROM settings WHERE name='default_category_id' LIMIT 1;");
        let firstRoom = null;
        if (defaultCatSetting && defaultCatSetting.value) {
            const defaultCatId = parseInt(defaultCatSetting.value);
            firstRoom = await dbQuery.get("SELECT room_id FROM rooms WHERE department_id = ? AND bookable = 1 ORDER BY name ASC LIMIT 1;", [defaultCatId]);
        }
        if (!firstRoom) {
            firstRoom = await dbQuery.get("SELECT room_id FROM rooms WHERE bookable = 1 ORDER BY name ASC LIMIT 1;");
        }
        if (firstRoom) {
            roomId = firstRoom.room_id;
        }
    }

    const room = await dbQuery.get(`
        SELECT r.*, d.name as department_name 
        FROM rooms r 
        LEFT JOIN departments d ON r.department_id = d.department_id 
        WHERE r.room_id = ?;
    `, [roomId]);

    if (!room) return null;

    const allRooms = await dbQuery.all("SELECT * FROM rooms WHERE bookable = 1 ORDER BY name ASC;");
    const periods = await dbQuery.all("SELECT * FROM periods ORDER BY time_start ASC;");
    const weeks = await dbQuery.all("SELECT * FROM weeks ORDER BY name ASC;");

    const curr = new Date(selectedDate);
    const day = curr.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(curr.setDate(curr.getDate() + mondayOffset));
    
    const weekDates = [];
    const weekDaysNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
    for (let i = 0; i < 5; i++) {
        const tempDate = new Date(monday);
        tempDate.setDate(monday.getDate() + i);
        weekDates.push(tempDate.toISOString().split('T')[0]);
    }

    const mondayStrDate = monday.toISOString().split('T')[0];
    const weekMap = await dbQuery.get("SELECT week_id FROM weekdates WHERE date = ?", [mondayStrDate]);
    const currentWeekId = weekMap ? weekMap.week_id : null;
    
    let weekName = '';
    if (currentWeekId) {
        const wk = await dbQuery.get("SELECT name FROM weeks WHERE week_id = ?", [currentWeekId]);
        if (wk) weekName = wk.name;
    }

    const allRoomBookings = await dbQuery.all(
        `SELECT b.*, u.displayname, u.username, u.firstname, u.lastname, w.name as week_name
         FROM bookings b
         LEFT JOIN users u ON b.user_id = u.user_id
         LEFT JOIN weeks w ON b.week_id = w.week_id
         WHERE b.room_id = ? AND b.cancelled = 0`,
        [roomId]
    );

    const gridBookings = {};
    for (const b of allRoomBookings) {
        if (b.date) {
            if (weekDates.includes(b.date)) {
                gridBookings[`${b.date}_${b.period_id}`] = b;
            }
        } else if (b.day_num !== null) {
            if (!b.week_id || b.week_id == currentWeekId) {
                const targetWeekDate = weekDates[b.day_num - 1];
                if (targetWeekDate) {
                    if (b.date_start && b.date_start > targetWeekDate) continue;
                    if (b.date_end && b.date_end < targetWeekDate) continue;
                }
                gridBookings[`day_${b.day_num}_${b.period_id}`] = b;
            }
        }
    }

    const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
    const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

    const prevWeekDate = new Date(monday);
    prevWeekDate.setDate(monday.getDate() - 7);
    const nextWeekDate = new Date(monday);
    nextWeekDate.setDate(monday.getDate() + 7);

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

    const defaultCatSetting = await dbQuery.get("SELECT value FROM settings WHERE name='default_category_id' LIMIT 1;");
    const systemDefaultCategoryId = (defaultCatSetting && defaultCatSetting.value) ? parseInt(defaultCatSetting.value) : null;

    const allWeekDates = await dbQuery.all("SELECT * FROM weekdates;");
    const weekDatesMap = {};
    for (const r of allWeekDates) {
        weekDatesMap[r.date] = r.week_id;
    }

    const academicYear = await dbQuery.get("SELECT * FROM academicyears LIMIT 1;");
    const isOutsideAcademicYear = (academicYear && academicYear.date_start && academicYear.date_end) ? (weekDates[4] < academicYear.date_start || weekDates[0] > academicYear.date_end) : false;

    const headerCategories = await dbQuery.all("SELECT * FROM departments ORDER BY name ASC;");

    return {
        schoolName,
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
        bookingRows: allRoomBookings,
        holidayMap,
        weekDatesMap,
        academicYear,
        isOutsideAcademicYear,
        systemDefaultCategoryId,
        headerCategories
    };
}

// GET /bookings/public & /public (Public Read-Only Booking Calendar - No Login Required)
router.get(['/bookings/public', '/public'], async (req, res) => {
    try {
        let roomId = req.query.room_id;
        let selectedDate = req.query.date;
        const data = await fetchBookingCalendarData(req, roomId, selectedDate);
        if (!data) {
            req.session.error = 'Der ausgewählte Raum existiert nicht.';
            return res.redirect('/login');
        }

        res.render('bookings', {
            ...data,
            title: `${data.room.name} (Öffentlicher Belegungsplan)`,
            displayName: (req.session && req.session.displayName) ? req.session.displayName : null,
            authlevel: (req.session && req.session.authlevel) ? req.session.authlevel : 0,
            currentUserId: (req.session && req.session.userId) ? req.session.userId : null,
            isPublicReadOnly: true,
            loadBookingScript: true,
            error: null,
            success: null
        });
    } catch (e) {
        console.error('Public bookings load error:', e);
        res.status(500).send('Interner Serverfehler.');
    }
});

// GET /bookings (Wochenplaner Grid Calendar)
router.get('/bookings', requireLogin, async (req, res) => {
    let roomId = req.query.room_id;
    let selectedDate = req.query.date;
    
    try {
        const data = await fetchBookingCalendarData(req, roomId, selectedDate);
        if (!data) {
            req.session.error = 'Der ausgewählte Raum existiert nicht.';
            return res.redirect('/bookings');
        }

        res.render('bookings', {
            ...data,
            title: 'Belegungsplan',
            displayName: req.session.displayName,
            authlevel: req.session.authlevel,
            currentUserId: req.session.userId,
            isPublicReadOnly: false,
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

// GET /bookings/daily & /daily (Chronological Daily Overview - Admin only)
router.get(['/bookings/daily', '/daily'], requireLogin, async (req, res) => {
    if (req.session.authlevel !== 1) {
        req.session.error = 'Zugriff verweigert. Die Tagesübersicht steht nur Administratoren zur Verfügung.';
        return res.redirect('/bookings');
    }

    let selectedDate = req.query.date;
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        selectedDate = new Date().toISOString().split('T')[0];
    }

    try {
        const parts = selectedDate.split('-');
        const dateObj = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
        const dayNum = dateObj.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        // Prev and Next dates
        const prevDateObj = new Date(dateObj);
        prevDateObj.setUTCDate(dateObj.getUTCDate() - 1);
        const prevDate = prevDateObj.toISOString().split('T')[0];

        const nextDateObj = new Date(dateObj);
        nextDateObj.setUTCDate(dateObj.getUTCDate() + 1);
        const nextDate = nextDateObj.toISOString().split('T')[0];

        // Format German date
        const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const weekdayName = weekdayNames[dayNum];
        const formattedDate = `${weekdayName}, ${parts[2]}.${parts[1]}.${parts[0]}`;

        // Turnus Week Calculation (Monday in UTC)
        const mOffset = dayNum === 0 ? -6 : 1 - dayNum;
        const mondayObj = new Date(dateObj);
        mondayObj.setUTCDate(dateObj.getUTCDate() + mOffset);
        const mondayStr = mondayObj.toISOString().split('T')[0];

        const weekMap = await dbQuery.get("SELECT week_id FROM weekdates WHERE date = ?", [mondayStr]);
        const currentWeekId = weekMap ? weekMap.week_id : null;
        let weekName = '';
        if (currentWeekId) {
            const wk = await dbQuery.get("SELECT name FROM weeks WHERE week_id = ?", [currentWeekId]);
            if (wk) weekName = wk.name;
        }

        // Check if holiday
        const holidays = await dbQuery.all("SELECT * FROM holidays;");
        const targetTime = new Date(selectedDate).getTime();
        const holiday = holidays.find(h => {
            const start = new Date(h.date_start).getTime();
            const end = new Date(h.date_end).getTime();
            return targetTime >= start && targetTime <= end;
        });

        // Fetch all periods
        const periods = await dbQuery.all("SELECT * FROM periods ORDER BY time_start ASC;");

        // Fetch all categories for quick filtering
        const allCategories = await dbQuery.all("SELECT * FROM departments ORDER BY name ASC;");

        // Fetch all single-date bookings for this date
        const singleBookings = await dbQuery.all(`
            SELECT b.*, r.name as room_name, r.icon as room_icon, r.department_id, d.name as department_name,
                   u.displayname, u.username, u.firstname, u.lastname
            FROM bookings b
            LEFT JOIN rooms r ON b.room_id = r.room_id
            LEFT JOIN departments d ON r.department_id = d.department_id
            LEFT JOIN users u ON b.user_id = u.user_id
            WHERE b.date = ? AND b.cancelled = 0
            ORDER BY r.name ASC
        `, [selectedDate]);

        // Fetch all recurring timetable blockings for this dayNum
        let timetableBookings = [];
        if (dayNum >= 1 && dayNum <= 5) {
            timetableBookings = await dbQuery.all(`
                SELECT b.*, r.name as room_name, r.icon as room_icon, r.department_id, d.name as department_name,
                       u.displayname, u.username, u.firstname, u.lastname, w.name as week_name
                FROM bookings b
                LEFT JOIN rooms r ON b.room_id = r.room_id
                LEFT JOIN departments d ON r.department_id = d.department_id
                LEFT JOIN users u ON b.user_id = u.user_id
                LEFT JOIN weeks w ON b.week_id = w.week_id
                WHERE b.day_num = ? AND b.date IS NULL AND b.cancelled = 0
                ORDER BY r.name ASC
            `, [dayNum]);

            // Filter timetable bookings by turnus and date_start/date_end validity
            timetableBookings = timetableBookings.filter(tb => {
                if (tb.week_id && currentWeekId && tb.week_id !== currentWeekId) return false;
                if (tb.date_start && tb.date_start > selectedDate) return false;
                if (tb.date_end && tb.date_end < selectedDate) return false;
                return true;
            });
        }

        // Group by period_id
        const bookingsByPeriod = {};
        let totalBookingsCount = 0;
        periods.forEach(p => {
            bookingsByPeriod[p.period_id] = [];
        });

        singleBookings.forEach(b => {
            b.is_single = true;
            if (!bookingsByPeriod[b.period_id]) bookingsByPeriod[b.period_id] = [];
            bookingsByPeriod[b.period_id].push(b);
            totalBookingsCount++;
        });

        timetableBookings.forEach(tb => {
            // Check if room is already booked by a single booking in this period
            const alreadyBooked = (bookingsByPeriod[tb.period_id] || []).some(b => b.room_id === tb.room_id);
            if (!alreadyBooked) {
                tb.is_timetable = true;
                if (!bookingsByPeriod[tb.period_id]) bookingsByPeriod[tb.period_id] = [];
                bookingsByPeriod[tb.period_id].push(tb);
                totalBookingsCount++;
            }
        });

        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        res.render('daily_overview', {
            title: `Tagesübersicht (${formattedDate})`,
            schoolName,
            displayName: req.session.displayName,
            authlevel: req.session.authlevel,
            currentUserId: req.session.userId,
            selectedDate,
            formattedDate,
            prevDate,
            nextDate,
            weekdayName,
            weekName,
            holiday: holiday ? holiday.name : null,
            periods,
            allCategories,
            bookingsByPeriod,
            totalBookingsCount,
            todayDate: new Date().toISOString().split('T')[0],
            error: req.session.error || null,
            success: req.session.success || null
        });

        req.session.error = null;
        req.session.success = null;

    } catch (e) {
        console.error('Daily overview load error:', e);
        res.status(500).send('Interner Serverfehler beim Laden der Tagesübersicht.');
    }
});

// POST /bookings/set-default-category (Set default category - Admin only setting)
router.post('/bookings/set-default-category', requireLogin, async (req, res) => {
    const { department_id, redirect_to } = req.body;
    
    // Authorization check: Admins only
    if (req.session.authlevel !== 1) {
        req.session.error = 'Zugriff verweigert. Nur Administratoren dürfen die Standard-Kategorie festlegen.';
        return res.redirect('/bookings');
    }

    try {
        const deptVal = department_id ? department_id.toString() : '';
        // Insert or replace in the settings table
        await dbQuery.run(`
            INSERT OR REPLACE INTO settings ("group", name, value)
            VALUES ('crbs', 'default_category_id', ?);
        `, [deptVal]);
        req.session.success = 'Systemweite Standard-Kategorie erfolgreich aktualisiert!';
    } catch (e) {
        console.error('Error saving default category setting:', e);
        req.session.error = 'Fehler beim Speichern der Standard-Kategorie.';
    }
    res.redirect(redirect_to || '/bookings');
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

        const isOverwrite = req.session.authlevel === 1 && req.body.overwrite === '1';

        if (booking_type === 'timetable' && req.session.authlevel === 1) {
            // Permanent timetable block with validity date range (Von - Bis)
            const parts = date.split('-');
            const parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
            const day_num = parsedDate.getDay(); // 1 = Monday, ..., 5 = Friday
            const targetWeekId = week_id ? parseInt(week_id) : null;
            const targetDateStart = (req.body.date_start && req.body.date_start.trim() !== '') ? req.body.date_start.trim() : date;
            let targetDateEnd = (req.body.date_end && req.body.date_end.trim() !== '') ? req.body.date_end.trim() : null;

            if (targetDateEnd && targetDateEnd < targetDateStart) {
                targetDateEnd = null;
            }

            // Check if there's already a timetable block OR a single-date booking for this day, period, and week rotation with overlapping dates
            let existing;
            let query = `SELECT b.*, u.displayname, u.username, w.name as week_name
                         FROM bookings b
                         LEFT JOIN users u ON b.user_id = u.user_id
                         LEFT JOIN weeks w ON b.week_id = w.week_id
                         WHERE b.room_id = ? AND b.period_id = ? AND b.day_num = ? AND b.date IS NULL AND b.cancelled = 0`;
            let params = [room_id, period_id, day_num];

            if (targetWeekId) {
                query += ` AND (b.week_id = ? OR b.week_id IS NULL)`;
                params.push(targetWeekId);
            }

            if (targetDateStart && targetDateEnd) {
                query += ` AND (b.date_end IS NULL OR b.date_end >= ?) AND (b.date_start IS NULL OR b.date_start <= ?)`;
                params.push(targetDateStart, targetDateEnd);
            } else if (targetDateStart) {
                query += ` AND (b.date_end IS NULL OR b.date_end >= ?)`;
                params.push(targetDateStart);
            }

            existing = await dbQuery.get(query, params);

            // If no timetable collision, check for single-date booking collision within date range
            if (!existing) {
                let singleQuery = `SELECT b.*, u.displayname, u.username
                                   FROM bookings b
                                   LEFT JOIN users u ON b.user_id = u.user_id
                                   WHERE b.room_id = ? AND b.period_id = ? AND b.date IS NOT NULL AND b.date >= ? AND b.cancelled = 0`;
                let singleParams = [room_id, period_id, targetDateStart];

                if (targetDateEnd) {
                    singleQuery += ` AND b.date <= ?`;
                    singleParams.push(targetDateEnd);
                }

                const singleBookings = await dbQuery.all(singleQuery, singleParams);
                for (const sb of singleBookings) {
                    const sbParts = sb.date.split('-');
                    if (sbParts.length !== 3) continue;
                    const sbUtc = new Date(Date.UTC(parseInt(sbParts[0]), parseInt(sbParts[1]) - 1, parseInt(sbParts[2])));
                    const sbDay = sbUtc.getUTCDay();
                    if (sbDay === day_num) {
                        // Calculate Monday for sb.date in UTC
                        const mOffset = sbDay === 0 ? -6 : 1 - sbDay;
                        sbUtc.setUTCDate(sbUtc.getUTCDate() + mOffset);
                        const sbMonday = sbUtc.toISOString().split('T')[0];

                        const sbWeekMap = await dbQuery.get("SELECT week_id FROM weekdates WHERE date = ?", [sbMonday]);
                        const sbWeekId = sbWeekMap ? sbWeekMap.week_id : null;

                        // If target specifies turnus (e.g. Ungerade) and single booking is in different turnus (e.g. Gerade), skip!
                        if (targetWeekId && sbWeekId && sbWeekId !== targetWeekId) {
                            continue;
                        }

                        existing = sb;
                        existing.is_single_booking = true;
                        break;
                    }
                }
            }

            if (existing) {
                if (isOverwrite) {
                    // Delete or soft-cancel colliding booking
                    if (existing.date) {
                        await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE booking_id = ?", [existing.booking_id]);
                    } else {
                        await dbQuery.run("DELETE FROM bookings WHERE booking_id = ?", [existing.booking_id]);
                    }
                } else {
                    const userName = existing.displayname || existing.username || 'Unbekannt';
                    const turnusInfo = existing.date ? `Einzelbuchung am ${existing.date}` : (existing.week_name ? `Turnus: ${existing.week_name}` : 'Turnus: Jede Woche');
                    const noteInfo = existing.notes ? ` (Notiz: "${existing.notes}")` : '';
                    req.session.error = `Kollision: Dieser Slot ist bereits belegt von ${userName}${noteInfo} [${turnusInfo}]! Setzen Sie den Haken bei "Kollisionen überschreiben", um ihn zu ersetzen.`;
                    return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
                }
            }

            // Insert new timetabled block with date_start and date_end
            await dbQuery.run(
                `INSERT INTO bookings (room_id, period_id, user_id, date, notes, cancelled, day_num, week_id, date_start, date_end) 
                 VALUES (?, ?, ?, NULL, ?, 0, ?, ?, ?, ?)`,
                [room_id, period_id, req.session.userId, notes || 'Unterricht', day_num, targetWeekId, targetDateStart, targetDateEnd]
            );

            req.session.success = isOverwrite ? 'Stundenplanblockierung gespeichert und bestehende Kollision überschrieben!' : 'Stundenplanblockierung erfolgreich gespeichert!';
            return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
        } else {
            // Check if Admin requested a range booking (multiple periods or multiple days)
            const isRangeBooking = req.session.authlevel === 1 && (
                req.body.is_range === '1' ||
                (req.body.date_end_booking && req.body.date_end_booking !== date) ||
                (req.body.period_id_end && req.body.period_id_end !== period_id)
            );

            if (isRangeBooking) {
                const startDate = date;
                let endDate = (req.body.date_end_booking && req.body.date_end_booking.trim() !== '') ? req.body.date_end_booking.trim() : startDate;
                if (endDate < startDate) endDate = startDate;

                const startPeriodId = parseInt(req.body.period_id_start || period_id);
                const endPeriodId = parseInt(req.body.period_id_end || period_id);

                const allPeriods = await dbQuery.all("SELECT * FROM periods ORDER BY time_start ASC;");
                let startPeriodIdx = allPeriods.findIndex(p => p.period_id === startPeriodId);
                let endPeriodIdx = allPeriods.findIndex(p => p.period_id === endPeriodId);

                if (startPeriodIdx === -1) startPeriodIdx = 0;
                if (endPeriodIdx === -1) endPeriodIdx = allPeriods.length - 1;

                if (startDate === endDate && endPeriodIdx < startPeriodIdx) {
                    const temp = startPeriodIdx;
                    startPeriodIdx = endPeriodIdx;
                    endPeriodIdx = temp;
                }

                // Holidays lookup
                const holidays = await dbQuery.all("SELECT * FROM holidays;");

                // Generate date sequence from startDate to endDate
                const slotsToBook = [];
                const curDateObj = new Date(startDate + 'T00:00:00Z');
                const endDateObj = new Date(endDate + 'T00:00:00Z');

                while (curDateObj <= endDateObj) {
                    const curDateStr = curDateObj.toISOString().split('T')[0];
                    const dayOfWeek = curDateObj.getUTCDay(); // 0=Sun, 6=Sat

                    // Skip weekends
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        // Check if holiday
                        const targetTime = new Date(curDateStr).getTime();
                        const isHoliday = holidays.some(h => {
                            const start = new Date(h.date_start).getTime();
                            const end = new Date(h.date_end).getTime();
                            return targetTime >= start && targetTime <= end;
                        });

                        if (!isHoliday) {
                            let pFrom = 0;
                            let pTo = allPeriods.length - 1;

                            if (startDate === endDate) {
                                pFrom = startPeriodIdx;
                                pTo = endPeriodIdx;
                            } else if (curDateStr === startDate) {
                                pFrom = startPeriodIdx;
                                pTo = allPeriods.length - 1;
                            } else if (curDateStr === endDate) {
                                pFrom = 0;
                                pTo = endPeriodIdx;
                            } else {
                                pFrom = 0;
                                pTo = allPeriods.length - 1;
                            }

                            for (let pIdx = pFrom; pIdx <= pTo; pIdx++) {
                                slotsToBook.push({
                                    date: curDateStr,
                                    period: allPeriods[pIdx]
                                });
                            }
                        }
                    }

                    curDateObj.setUTCDate(curDateObj.getUTCDate() + 1);
                }

                if (slotsToBook.length === 0) {
                    req.session.error = 'Im ausgewählten Zeitraum liegen keine regulären Unterrichtstage (z. B. nur Wochenende oder Ferien).';
                    return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
                }

                // Collision check across all slotsToBook
                const collisions = [];
                for (const slot of slotsToBook) {
                    // Check single booking collision
                    const singleColl = await dbQuery.get(`
                        SELECT b.*, u.displayname, u.username
                        FROM bookings b
                        LEFT JOIN users u ON b.user_id = u.user_id
                        WHERE b.room_id = ? AND b.period_id = ? AND b.date = ? AND b.cancelled = 0
                    `, [room_id, slot.period.period_id, slot.date]);

                    if (singleColl) {
                        collisions.push({
                            slot,
                            coll: singleColl,
                            type: 'single'
                        });
                        continue;
                    }

                    // Check timetable collision
                    const slotParts = slot.date.split('-');
                    const slotUtc = new Date(Date.UTC(parseInt(slotParts[0]), parseInt(slotParts[1]) - 1, parseInt(slotParts[2])));
                    const slotDayNum = slotUtc.getUTCDay();

                    // Find Monday of slot
                    const slotMOffset = slotDayNum === 0 ? -6 : 1 - slotDayNum;
                    slotUtc.setUTCDate(slotUtc.getUTCDate() + slotMOffset);
                    const slotMonday = slotUtc.toISOString().split('T')[0];

                    const slotWk = await dbQuery.get("SELECT week_id FROM weekdates WHERE date = ?", [slotMonday]);
                    const slotWeekId = slotWk ? slotWk.week_id : null;

                    const ttColl = await dbQuery.get(`
                        SELECT b.*, u.displayname, u.username, w.name as week_name
                        FROM bookings b
                        LEFT JOIN users u ON b.user_id = u.user_id
                        LEFT JOIN weeks w ON b.week_id = w.week_id
                        WHERE b.room_id = ? AND b.period_id = ? AND b.day_num = ? AND b.date IS NULL AND b.cancelled = 0
                          AND (b.week_id IS NULL OR b.week_id = ?)
                          AND (b.date_start IS NULL OR b.date_start <= ?)
                          AND (b.date_end IS NULL OR b.date_end >= ?)
                    `, [room_id, slot.period.period_id, slotDayNum, slotWeekId, slot.date, slot.date]);

                    if (ttColl) {
                        collisions.push({
                            slot,
                            coll: ttColl,
                            type: 'timetable'
                        });
                    }
                }

                if (collisions.length > 0) {
                    if (isOverwrite) {
                        // Soft-cancel or delete colliding bookings
                        for (const c of collisions) {
                            if (c.type === 'single') {
                                await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE booking_id = ?", [c.coll.booking_id]);
                            } else {
                                await dbQuery.run("DELETE FROM bookings WHERE booking_id = ?", [c.coll.booking_id]);
                            }
                        }
                    } else {
                        const collDetails = collisions.slice(0, 4).map(c => {
                            const uName = c.coll.displayname || c.coll.username || 'Unbekannt';
                            const note = c.coll.notes ? ` ("${c.coll.notes}")` : '';
                            return `${c.slot.date.split('-').reverse().join('.')} (${c.slot.period.name}): belegt von ${uName}${note}`;
                        }).join('; ');
                        const moreText = collisions.length > 4 ? ` ...und ${collisions.length - 4} weitere` : '';

                        req.session.error = `Kollisionen im Zeitraum gefunden (${collisions.length} Konflikte): ${collDetails}${moreText}. Setzen Sie den Haken bei "Kollisionen überschreiben", um diese zu ersetzen.`;
                        return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
                    }
                }

                // Generate group_id for multi-slot booking
                const groupId = slotsToBook.length > 1 ? `grp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` : null;

                for (const slot of slotsToBook) {
                    await dbQuery.run(`
                        INSERT INTO bookings (room_id, period_id, user_id, date, notes, cancelled, group_id)
                        VALUES (?, ?, ?, ?, ?, 0, ?)
                    `, [room_id, slot.period.period_id, req.session.userId, slot.date, notes || '', groupId]);
                }

                const dateDisplayStart = startDate.split('-').reverse().join('.');
                const dateDisplayEnd = endDate.split('-').reverse().join('.');
                const timeSpanText = startDate === endDate ? `am ${dateDisplayStart}` : `vom ${dateDisplayStart} bis ${dateDisplayEnd}`;

                req.session.success = isOverwrite 
                    ? `Erfolgreich ${slotsToBook.length} Stunde(n) ${timeSpanText} gebucht und bestehende Kollisionen überschrieben!`
                    : `Erfolgreich ${slotsToBook.length} Stunde(n) ${timeSpanText} gebucht!`;
                return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
            }

            // Standard single booking
            const existing = await dbQuery.get(
                `SELECT b.*, u.displayname, u.username
                 FROM bookings b
                 LEFT JOIN users u ON b.user_id = u.user_id
                 WHERE b.room_id = ? AND b.period_id = ? AND b.date = ? AND b.cancelled = 0`,
                [room_id, period_id, date]
            );

            if (existing) {
                if (isOverwrite) {
                    // Soft-cancel colliding single booking
                    await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE booking_id = ?", [existing.booking_id]);
                } else {
                    const userName = existing.displayname || existing.username || 'Unbekannt';
                    const noteInfo = existing.notes ? ` (Notiz: "${existing.notes}")` : '';
                    req.session.error = `Kollision: Dieser Raum ist an diesem Datum bereits belegt von ${userName}${noteInfo}! ${req.session.authlevel === 1 ? 'Setzen Sie einen Haken bei "Kollisionen überschreiben", um die Buchung zu ersetzen.' : ''}`;
                    return res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
                }
            }

            // Insert new booking
            await dbQuery.run(
                `INSERT INTO bookings (room_id, period_id, user_id, date, notes, cancelled) VALUES (?, ?, ?, ?, ?, 0)`,
                [room_id, period_id, req.session.userId, date, notes || '']
            );

            req.session.success = isOverwrite ? 'Raum gebucht und bestehende Kollision überschrieben!' : 'Raum erfolgreich gebucht!';
            res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
        }

    } catch (e) {
        console.error('Add booking error:', e);
        req.session.error = 'Fehler beim Speichern der Buchung: ' + (e.message || e);
        res.redirect(`/bookings?room_id=${room_id}&date=${date}`);
    }
});

// POST /bookings/cancel (Cancel Dynamic Booking or Timetable Block)
router.post('/bookings/cancel', requireLogin, async (req, res) => {
    const { booking_id, room_id, date, redirect_to, cancel_all_group } = req.body;

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

        if (cancel_all_group === '1' && booking.group_id) {
            // Cancel all bookings sharing this group_id
            await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE group_id = ?", [booking.group_id]);
            req.session.success = 'Alle Buchungen des zusammenhängenden Zeitraums wurden erfolgreich storniert!';
        } else if (booking.date === null || booking.day_num !== null) {
            // If it's a timetable entry (date IS NULL or day_num IS NOT NULL), delete it completely
            await dbQuery.run("DELETE FROM bookings WHERE booking_id = ?", [booking_id]);
            req.session.success = 'Stundenplaneintrag erfolgreich gelöscht!';
        } else {
            await dbQuery.run("UPDATE bookings SET cancelled = 1 WHERE booking_id = ?", [booking_id]);
            req.session.success = 'Buchung erfolgreich storniert!';
        }

        res.redirect(redirect_to || `/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);

    } catch (e) {
        console.error('Cancel booking error:', e);
        req.session.error = 'Fehler beim Stornieren der Buchung.';
        res.redirect(redirect_to || '/bookings');
    }
});

// POST /bookings/edit (Edit existing booking or timetable block - Admin or Owner)
router.post('/bookings/edit', requireLogin, async (req, res) => {
    const { booking_id, room_id, date, notes, week_id, date_start, date_end, redirect_to } = req.body;
    if (!booking_id) {
        req.session.error = 'Ungültige Buchungs-ID.';
        return res.redirect(redirect_to || '/bookings');
    }
    try {
        const booking = await dbQuery.get("SELECT * FROM bookings WHERE booking_id = ?", [booking_id]);
        if (!booking) {
            req.session.error = 'Die Buchung existiert nicht.';
            return res.redirect(redirect_to || '/bookings');
        }

        // Verify authorization: User can only edit their own booking, unless they are admin (authlevel = 1)
        if (booking.user_id !== req.session.userId && req.session.authlevel !== 1) {
            req.session.error = 'Sie sind nicht berechtigt, diese Buchung zu bearbeiten.';
            return res.redirect(redirect_to || `/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);
        }
        
        const targetNotes = notes !== undefined ? notes : booking.notes;

        if (booking.day_num !== null) {
            // Timetable block (Admin only for turnus & date range)
            if (req.session.authlevel !== 1) {
                req.session.error = 'Nur Administratoren dürfen Dauerbuchungen bearbeiten.';
                return res.redirect(redirect_to || `/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);
            }

            const targetWeekId = (week_id !== undefined && week_id !== '') ? parseInt(week_id) : null;
            const targetDateStart = (date_start !== undefined && date_start.trim() !== '') ? date_start.trim() : booking.date_start;
            let targetDateEnd = (date_end !== undefined) ? (date_end.trim() !== '' ? date_end.trim() : null) : booking.date_end;

            if (targetDateEnd && targetDateStart && targetDateEnd < targetDateStart) {
                targetDateEnd = null;
            }

            await dbQuery.run(
                `UPDATE bookings SET notes = ?, week_id = ?, date_start = ?, date_end = ? WHERE booking_id = ?`,
                [targetNotes || 'Unterricht', targetWeekId, targetDateStart, targetDateEnd, booking_id]
            );
        } else {
            // Single booking
            await dbQuery.run("UPDATE bookings SET notes = ? WHERE booking_id = ?", [targetNotes || '', booking_id]);
        }

        req.session.success = 'Buchungsdetails erfolgreich aktualisiert!';
        res.redirect(redirect_to || `/bookings?room_id=${room_id || booking.room_id}&date=${date || booking.date}`);
    } catch (e) {
        console.error('Edit booking error:', e);
        req.session.error = 'Fehler beim Bearbeiten der Buchung: ' + (e.message || e);
        res.redirect(redirect_to || '/bookings');
    }
});

// GET /bookings/my-bookings (View Logged-in User's Bookings - Future / Archive with limit-50 pagination)
router.get('/bookings/my-bookings', requireLogin, async (req, res) => {
    const showArchive = req.query.archive === 'true';
    const today = new Date().toISOString().split('T')[0];
    
    let page = parseInt(req.query.page) || 1;
    if (page < 1) page = 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        const schoolNameSetting = await dbQuery.get("SELECT value FROM settings WHERE name='name' LIMIT 1;");
        const schoolName = schoolNameSetting ? schoolNameSetting.value : 'Raumbelegung MSO';

        let countResult;
        if (showArchive) {
            countResult = await dbQuery.get(`
                SELECT COUNT(*) as count 
                FROM bookings b
                WHERE b.user_id = ? AND b.cancelled = 0 AND b.date < ? AND b.date IS NOT NULL
            `, [req.session.userId, today]);
        } else {
            countResult = await dbQuery.get(`
                SELECT COUNT(*) as count 
                FROM bookings b
                WHERE b.user_id = ? AND b.cancelled = 0 AND (b.date >= ? OR b.date IS NULL)
            `, [req.session.userId, today]);
        }

        const totalBookings = countResult.count;
        const totalPages = Math.ceil(totalBookings / limit) || 1;

        let bookings = [];
        if (showArchive) {
            bookings = await dbQuery.all(`
                SELECT b.*, r.name as room_name, p.name as period_name, p.time_start, p.time_end, w.name as week_name 
                FROM bookings b
                JOIN rooms r ON b.room_id = r.room_id
                JOIN periods p ON b.period_id = p.period_id
                LEFT JOIN weeks w ON b.week_id = w.week_id
                WHERE b.user_id = ? AND b.cancelled = 0 AND b.date < ? AND b.date IS NOT NULL
                ORDER BY b.date DESC, p.time_start DESC
                LIMIT ? OFFSET ?;
            `, [req.session.userId, today, limit, offset]);
        } else {
            bookings = await dbQuery.all(`
                SELECT b.*, r.name as room_name, p.name as period_name, p.time_start, p.time_end, w.name as week_name 
                FROM bookings b
                JOIN rooms r ON b.room_id = r.room_id
                JOIN periods p ON b.period_id = p.period_id
                LEFT JOIN weeks w ON b.week_id = w.week_id
                WHERE b.user_id = ? AND b.cancelled = 0 AND (b.date >= ? OR b.date IS NULL)
                ORDER BY b.date ASC, p.time_start ASC, b.day_num ASC
                LIMIT ? OFFSET ?;
            `, [req.session.userId, today, limit, offset]);
        }

        res.render('my_bookings', {
            title: 'Meine Buchungen',
            schoolName,
            displayName: req.session.displayName,
            authlevel: req.session.authlevel,
            currentUserId: req.session.userId,
            bookings,
            showArchive,
            currentPage: page,
            totalPages,
            loadBookingScript: true,
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
