
import cron from 'node-cron';
import { User } from '../models/user.model';
import { ChatQueueService } from './chatQueue.service';

/**
 * Chat Persistent Worker (Runs every 1s)
 */
export const startChatWorker = () => {
    setInterval(async () => {
        await ChatQueueService.flushQueue();
    }, 1000); // 1 second interval
};

/**
 * Cleanup Stale Calls Job (Neutralized - calling system disabled)
 */
export const startCallCleanupJob = () => {
    // Calling system has been permanently disabled; no cleanup job needed.
};


/**
 * Weekly Host Level Upgrade & Downgrade Cron Job
 * Runs every Sunday night at 12:00 AM (Monday 00:00:00)
 */
export const startWeeklyHostLevelJob = () => {
    // Cron schedule '0 0 * * 1' runs at 00:00:00 every Monday (Sunday 12:00 AM midnight) in Asia/Kolkata timezone
    cron.schedule('0 0 * * 1', async () => {
        console.log('⚡ Weekly Host Level Cron Fired at Sunday Midnight (Monday 00:00:00 IST)!');
        try {
            const { runWeeklyHostLevelRecalculation } = await import('./user.service');
            await runWeeklyHostLevelRecalculation();
        } catch (err) {
            console.error('❌ Weekly Host Level Cron Error:', err);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });
};

/**
 * 2-Hour Stale Host Inactivity Auto-Deactivation Job
 * Runs every 2 minutes to deactivate hosts who have not opened or used the app for 2 hours (120 minutes),
 * even if their Id Manage setting was left ON.
 */
export const startStaleHostCleanupJob = () => {
    cron.schedule('*/2 * * * *', async () => {
        try {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const staleFilter = {
                role: 'host',
                isActive: true,
                $and: [
                    { $or: [{ lastActiveAt: { $lt: twoHoursAgo } }, { lastActiveAt: { $exists: false } }] },
                    { $or: [{ lastOnline: { $lt: twoHoursAgo } }, { lastOnline: { $exists: false } }] },
                    { updatedAt: { $lt: twoHoursAgo } }
                ]
            };

            const result = await User.updateMany(staleFilter, { $set: { isActive: false, isOnline: false } });
            if (result.modifiedCount > 0) {
                console.log(`🧹 [HOST_CLEANUP] Deactivated ${result.modifiedCount} hosts due to 2 hours of app inactivity.`);
            }
        } catch (error) {
            console.error('Stale Host Cleanup Error:', error);
        }
    });
};
