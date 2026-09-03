const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../local/booking.db');

// Ensure local directory exists
const localDir = path.dirname(dbPath);
if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening SQLite database:', err);
    } else {
        console.log('Successfully connected to SQLite database at:', dbPath);
        initializeDatabase();
    }
});

// Helper for DB queries
const dbQuery = {
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    },
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

async function initializeDatabase() {
    try {
        // Enable foreign keys
        await dbQuery.run('PRAGMA foreign_keys = ON;');

        // Run migrations for existing databases
        const bookingsTableCheck = await dbQuery.get("SELECT name FROM sqlite_master WHERE type='table' AND name='bookings';");
        if (bookingsTableCheck) {
            try { await dbQuery.run("ALTER TABLE bookings ADD COLUMN date_start TEXT;"); } catch(e){}
            try { await dbQuery.run("ALTER TABLE bookings ADD COLUMN date_end TEXT;"); } catch(e){}
            try { await dbQuery.run("ALTER TABLE bookings ADD COLUMN group_id TEXT;"); } catch(e){}
        }

        const periodsTableCheck = await dbQuery.get("SELECT name FROM sqlite_master WHERE type='table' AND name='periods';");
        if (periodsTableCheck) {
            try { await dbQuery.run("ALTER TABLE periods ADD COLUMN color TEXT;"); } catch(e){}
        }

        // Check if users table exists
        const tableCheck = await dbQuery.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users';");
        if (tableCheck) {
            console.log('Database tables already exist.');
            return;
        }

        console.log('SQLite Database is empty. Running database initialization...');

        // 1. academicyears
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS academicyears (
            date_start TEXT NOT NULL,
            date_end TEXT NOT NULL
        );`);

        // 2. bookings
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS bookings (
            booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
            period_id INTEGER NOT NULL,
            week_id INTEGER,
            day_num INTEGER,
            room_id INTEGER NOT NULL,
            user_id INTEGER,
            date TEXT,
            notes TEXT,
            cancelled INTEGER NOT NULL DEFAULT 0,
            date_start TEXT,
            date_end TEXT,
            group_id TEXT
        );`);

        // 3. departments
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS departments (
            department_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT
        );`);

        // 4. holidays
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS holidays (
            holiday_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date_start TEXT NOT NULL,
            date_end TEXT NOT NULL
        );`);

        // 5. periods
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS periods (
            period_id INTEGER PRIMARY KEY AUTOINCREMENT,
            time_start TEXT NOT NULL,
            time_end TEXT NOT NULL,
            name TEXT NOT NULL,
            days INTEGER NOT NULL,
            bookable INTEGER NOT NULL DEFAULT 0,
            color TEXT
        );`);

        // 6. roomfields
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS roomfields (
            field_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT
        );`);

        // 7. roomoptions
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS roomoptions (
            option_id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_id INTEGER NOT NULL,
            value TEXT
        );`);

        // 8. rooms
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS rooms (
            room_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            department_id INTEGER,
            name TEXT NOT NULL,
            location TEXT,
            bookable INTEGER NOT NULL DEFAULT 0,
            icon TEXT,
            notes TEXT,
            photo TEXT
        );`);

        // 9. roomvalues
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS roomvalues (
            value_id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            field_id INTEGER NOT NULL,
            value TEXT
        );`);

        // 10. settings
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS settings (
            "group" TEXT NOT NULL,
            name TEXT NOT NULL,
            value TEXT
        );`);
        await dbQuery.run(`CREATE UNIQUE INDEX IF NOT EXISTS group_name ON settings ("group", name);`);

        // 11. users
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            department_id INTEGER,
            username TEXT NOT NULL UNIQUE,
            firstname TEXT,
            lastname TEXT,
            email TEXT,
            password TEXT,
            authlevel INTEGER NOT NULL,
            displayname TEXT,
            ext TEXT,
            lastlogin TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            created TEXT
        );`);

        // 12. weekdates
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS weekdates (
            week_id INTEGER NOT NULL,
            date TEXT NOT NULL
        );`);

        // 13. weeks
        await dbQuery.run(`CREATE TABLE IF NOT EXISTS weeks (
            week_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            fgcol TEXT,
            bgcol TEXT,
            icon TEXT
        );`);

        // Seeding initial Admin User (admin / admin)
        const salt = await bcrypt.genSalt(10);
        const adminHash = await bcrypt.hash('admin', salt);
        await dbQuery.run(`INSERT INTO users (username, password, authlevel, enabled, created) VALUES (?, ?, 1, 1, ?)`,
            ['admin', adminHash, new Date().toISOString()]
        );

        // Seeding default settings
        const defaultSettings = [
            ['crbs', 'bia', '0'],
            ['crbs', 'colour', '2563eb'],
            ['crbs', 'displaytype', 'day'],
            ['crbs', 'd_columns', 'periods'],
            ['crbs', 'logo', ''],
            ['crbs', 'website', ''],
            ['crbs', 'name', 'Raumbelegung MSO']
        ];
        for (const [group, name, value] of defaultSettings) {
            await dbQuery.run(`INSERT OR IGNORE INTO settings ("group", name, value) VALUES (?, ?, ?)`, [group, name, value]);
        }

        // Seeding default periods (1. - 6. Stunde)
        const defaultPeriods = [
            ['07:45:00', '08:30:00', '1. Stunde', 62, 1],
            ['08:35:00', '09:20:00', '2. Stunde', 62, 1],
            ['09:40:00', '10:25:00', '3. Stunde', 62, 1],
            ['10:30:00', '11:15:00', '4. Stunde', 62, 1],
            ['11:35:00', '12:20:00', '5. Stunde', 62, 1],
            ['12:25:00', '13:10:00', '6. Stunde', 62, 1]
        ];
        for (const [start, end, name, days, bookable] of defaultPeriods) {
            await dbQuery.run(`INSERT INTO periods (time_start, time_end, name, days, bookable) VALUES (?, ?, ?, ?, ?)`, 
                [start, end, name, days, bookable]
            );
        }

        // Seeding default rooms (uid, name, department_id, bookable, icon, notes, photo)
        const defaultRooms = [
            [null, 'R 101', 1, 1, 'computer', 'Computerraum', ''],
            [null, 'R 202', 2, 1, 'science', 'Biologieraum', ''],
            [null, 'Sporthalle', 3, 1, 'sport', 'Grosse Sporthalle', '']
        ];
        for (const [uid, name, deptId, bookable, icon, notes, photo] of defaultRooms) {
            await dbQuery.run(`INSERT INTO rooms (user_id, name, department_id, bookable, icon, notes, photo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uid, name, deptId, bookable, icon, notes, photo]
            );
        }

        // Seeding default weeks (A/B-Wochen)
        const defaultWeeks = [
            [1, 'A-Woche (Ungerade)', 'FFFFFF', '2563EB', 'calendar'],
            [2, 'B-Woche (Gerade)', 'FFFFFF', '10B981', 'calendar']
        ];
        for (const [id, name, fgcol, bgcol, icon] of defaultWeeks) {
            await dbQuery.run(`INSERT OR IGNORE INTO weeks (week_id, name, fgcol, bgcol, icon) VALUES (?, ?, ?, ?, ?)`, [id, name, fgcol, bgcol, icon]);
        }

        // Seeding default departments (Kategorien)
        const defaultDepartments = [
            [1, 'Informatik & Medien', 'Computerraeume und Medientechnik', 'computer'],
            [2, 'Naturwissenschaften', 'Biologie, Chemie und Physik Labore', 'science'],
            [3, 'Sport & Bewegung', 'Sporthallen und Aussengelaende', 'sport']
        ];
        for (const [id, name, desc, icon] of defaultDepartments) {
            await dbQuery.run(`INSERT OR IGNORE INTO departments (department_id, name, description, icon) VALUES (?, ?, ?, ?)`, [id, name, desc, icon]);
        }

        // Seeding some Academic Year (current date ranges)
        await dbQuery.run(`INSERT INTO academicyears (date_start, date_end) VALUES (?, ?)`,
            ['2025-08-01', '2026-07-31']
        );

        // Seeding some calendar week mappings for June 2026
        const defaultWeekDates = [
            [1, '2026-06-01'],
            [2, '2026-06-08'],
            [1, '2026-06-15'],
            [2, '2026-06-22'],
            [1, '2026-06-29']
        ];
        for (const [weekId, date] of defaultWeekDates) {
            await dbQuery.run(`INSERT OR IGNORE INTO weekdates (week_id, date) VALUES (?, ?)`, [weekId, date]);
        }

        // Seeding some sample recurring timetable bookings (cancelled = 0)
        const bookingCheck = await dbQuery.get("SELECT COUNT(*) as count FROM bookings;");
        if (bookingCheck.count === 0) {
            const defaultRecurringBookings = [
                // dayNum (1=Mon, 3=Wed), weekId (1=A, 2=B, null=All), roomId (1=R101), periodId (1=1st hour, 3=3rd hour), userId (1=admin), notes
                [1, 1, 1, 1, 1, null, '10a Informatik (A-Woche)'],
                [1, 2, 1, 1, 1, null, '10b Informatik (B-Woche)'],
                [3, null, 1, 3, 1, null, 'Foerderunterricht (Woechentlich)']
            ];
            for (const [dayNum, weekId, roomId, periodId, userId, date, notes] of defaultRecurringBookings) {
                await dbQuery.run(`INSERT INTO bookings (day_num, week_id, room_id, period_id, user_id, date, notes, cancelled) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                    [dayNum, weekId, roomId, periodId, userId, date, notes]
                );
            }
        }

        console.log('Database initialization completed successfully!');

    } catch (e) {
        console.error('Fatal error during database seeding:', e);
    }
}

module.exports = {
    db,
    dbQuery
};
