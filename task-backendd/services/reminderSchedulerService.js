const ReminderJob = require('../models/ReminderJob');
const Task = require('../models/Task');
const User = require('../models/User');
const { sendNotification } = require('./notificationService');

let workerInterval = null;

/**
 * Schedule a persistent reminder job in MongoDB.
 */
async function scheduleTaskReminder({
  taskId,
  userId,
  reminderType = 'DUE_DATE',
  scheduledAt,
  metadata = {}
}) {
  if (!taskId || !userId || !scheduledAt) {
    throw new Error('taskId, userId, and scheduledAt are required to schedule a reminder');
  }

  const dedupKey = `reminder:${taskId.toString()}:${reminderType}:${new Date(scheduledAt).getTime()}`;

  let job = await ReminderJob.findOne({ deduplicationKey: dedupKey });
  if (job) {
    return job; // Idempotent return
  }

  job = new ReminderJob({
    taskId,
    userId,
    reminderType,
    scheduledAt: new Date(scheduledAt),
    status: 'PENDING',
    deduplicationKey: dedupKey,
    metadata
  });

  await job.save();
  return job;
}

/**
 * Process all pending reminder jobs that are due for execution.
 * Respects user timezone and updates persistent job status in MongoDB.
 */
async function processPendingReminders(io = null) {
  const now = new Date();
  const dueJobs = await ReminderJob.find({
    status: 'PENDING',
    scheduledAt: { $lte: now }
  }).limit(50);

  if (dueJobs.length === 0) {
    return { processed: 0, executed: 0 };
  }

  let executedCount = 0;

  for (const job of dueJobs) {
    try {
      const task = await Task.findById(job.taskId);
      const user = await User.findById(job.userId);

      if (!task || task.completed || task.deletedAt) {
        job.status = 'CANCELLED';
        await job.save();
        continue;
      }

      const userTimezone = (user && user.timezone) ? user.timezone : 'UTC';

      // Send notification via centralized notification service
      await sendNotification({
        recipient: job.userId,
        type: 'TASK_REMINDER',
        title: `Task Reminder: ${task.title}`,
        message: `Reminder for "${task.title}" (Due: ${task.dueDate ? new Date(task.dueDate).toISOString() : 'N/A'}, Timezone: ${userTimezone})`,
        taskId: task._id,
        projectId: task.projectId,
        deduplicationKey: `notification:${job.deduplicationKey}`,
        metadata: { ...job.metadata, userTimezone },
        io
      });

      job.status = 'EXECUTED';
      await job.save();
      executedCount++;
    } catch (err) {
      console.error(`Error processing reminder job ${job._id}:`, err);
      job.retryCount = (job.retryCount || 0) + 1;
      if (job.retryCount >= 3) {
        job.status = 'FAILED';
      }
      await job.save();
    }
  }

  return { processed: dueJobs.length, executed: executedCount };
}

/**
 * Start persistent background scheduler worker.
 */
function startReminderWorker(io = null, intervalMs = 15000) {
  if (workerInterval) return;

  // Run initial check on start
  processPendingReminders(io).catch(err => console.error('Reminder worker error:', err));

  workerInterval = setInterval(() => {
    processPendingReminders(io).catch(err => console.error('Reminder worker error:', err));
  }, intervalMs);
}

/**
 * Stop background scheduler worker cleanly.
 */
function stopReminderWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

module.exports = {
  scheduleTaskReminder,
  processPendingReminders,
  startReminderWorker,
  stopReminderWorker
};
