/**
 * Standalone Database Cleanup Utility for CRBS / MSO Rumbs
 * Cleans up orphaned bookings referencing deleted rooms, users, or periods.
 * 
 * Usage:
 *   node src/scripts/cleanup_orphans.js [--dry-run]
 */

const { dbQuery } = require('../db');

async function runCleanup() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log('====================================================');
    console.log('MSO Rumbs Database Cleanup Utility');
    console.log('Mode: ' + (isDryRun ? 'DRY-RUN (No changes will be written)' : 'LIVE CLEANUP'));
    console.log('====================================================');

    try {
        // Wait a short moment for SQLite connection initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // 1. Orphaned Rooms
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

        console.log(`\n🔍 Found ${totalOrphanRoomBookings} bookings referencing deleted / invalid rooms (${orphanRooms.length} room IDs):`);
        if (orphanRooms.length > 0) {
            console.table(orphanRooms);
        } else {
            console.log('  ✓ No orphaned room bookings found.');
        }

        // 2. Orphaned Users
        const orphanUsers = await dbQuery.all(`
            SELECT b.user_id, COUNT(*) as cnt
            FROM bookings b 
            WHERE b.user_id NOT IN (SELECT user_id FROM users)
            GROUP BY b.user_id;
        `);
        const totalOrphanUserBookings = orphanUsers.reduce((sum, u) => sum + u.cnt, 0);
        console.log(`\n🔍 Found ${totalOrphanUserBookings} bookings referencing deleted users:`);
        if (orphanUsers.length > 0) {
            console.table(orphanUsers);
        } else {
            console.log('  ✓ No orphaned user bookings found.');
        }

        // 3. Orphaned Periods
        const orphanPeriods = await dbQuery.all(`
            SELECT b.period_id, COUNT(*) as cnt
            FROM bookings b 
            WHERE b.period_id NOT IN (SELECT period_id FROM periods)
            GROUP BY b.period_id;
        `);
        const totalOrphanPeriodBookings = orphanPeriods.reduce((sum, p) => sum + p.cnt, 0);
        console.log(`\n🔍 Found ${totalOrphanPeriodBookings} bookings referencing deleted periods:`);
        if (orphanPeriods.length > 0) {
            console.table(orphanPeriods);
        } else {
            console.log('  ✓ No orphaned period bookings found.');
        }

        const totalOrphans = totalOrphanRoomBookings + totalOrphanUserBookings + totalOrphanPeriodBookings;

        if (totalOrphans === 0) {
            console.log('\n🎉 The database is already 100% clean! No orphaned entries found.');
            process.exit(0);
        }

        if (isDryRun) {
            console.log(`\n⚠️ DRY-RUN finished. Found ${totalOrphans} orphaned records that would be removed.`);
            process.exit(0);
        }

        // Perform Deletions
        console.log('\n🧹 Executing cleanup...');

        let deletedRoomsCount = 0;
        if (totalOrphanRoomBookings > 0) {
            const res = await dbQuery.run(`
                DELETE FROM bookings 
                WHERE room_id NOT IN (SELECT room_id FROM rooms) OR room_id = 0 OR room_id IS NULL;
            `);
            deletedRoomsCount = res.changes || totalOrphanRoomBookings;
            console.log(`  ✓ Deleted ${deletedRoomsCount} orphaned room bookings.`);
        }

        let deletedUsersCount = 0;
        if (totalOrphanUserBookings > 0) {
            const res = await dbQuery.run(`
                DELETE FROM bookings 
                WHERE user_id NOT IN (SELECT user_id FROM users);
            `);
            deletedUsersCount = res.changes || totalOrphanUserBookings;
            console.log(`  ✓ Deleted ${deletedUsersCount} orphaned user bookings.`);
        }

        let deletedPeriodsCount = 0;
        if (totalOrphanPeriodBookings > 0) {
            const res = await dbQuery.run(`
                DELETE FROM bookings 
                WHERE period_id NOT IN (SELECT period_id FROM periods);
            `);
            deletedPeriodsCount = res.changes || totalOrphanPeriodBookings;
            console.log(`  ✓ Deleted ${deletedPeriodsCount} orphaned period bookings.`);
        }

        console.log('\n====================================================');
        console.log(`✨ Cleanup complete! Removed ${deletedRoomsCount + deletedUsersCount + deletedPeriodsCount} orphaned records.`);
        console.log('====================================================');
        process.exit(0);

    } catch (err) {
        console.error('Fatal cleanup error:', err);
        process.exit(1);
    }
}

runCleanup();
