const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const ReminderJob = require('../models/ReminderJob');
const Notification = require('../models/Notification');
const { scheduleTaskReminder, processPendingReminders } = require('../services/reminderSchedulerService');

require('./setup');

describe('Reminder Scheduler & Timezone Execution Tests', () => {
  let user, task;

  beforeEach(async () => {
    user = new User({
      username: 'reminderuser',
      password: 'password123',
      timezone: 'America/New_York'
    });
    await user.save();

    task = new Task({
      title: 'Scheduled Due Task',
      user: user._id,
      assignedTo: user._id,
      dueDate: new Date(Date.now() - 60000) // 1 minute in past (due)
    });
    await task.save();
  });

  it('should schedule a persistent reminder job in MongoDB with deduplicationKey', async () => {
    const job1 = await scheduleTaskReminder({
      taskId: task._id,
      userId: user._id,
      scheduledAt: task.dueDate
    });

    expect(job1).toBeDefined();
    expect(job1.status).toEqual('PENDING');

    // Duplicate scheduling attempt returns existing job without duplicating
    const job2 = await scheduleTaskReminder({
      taskId: task._id,
      userId: user._id,
      scheduledAt: task.dueDate
    });

    expect(job1._id.toString()).toEqual(job2._id.toString());

    const count = await ReminderJob.countDocuments({ taskId: task._id });
    expect(count).toEqual(1);
  });

  it('should process pending due reminder jobs, respect user timezone, and dispatch notifications', async () => {
    await scheduleTaskReminder({
      taskId: task._id,
      userId: user._id,
      scheduledAt: task.dueDate
    });

    const result = await processPendingReminders();
    expect(result.executed).toEqual(1);

    const jobAfter = await ReminderJob.findOne({ taskId: task._id });
    expect(jobAfter.status).toEqual('EXECUTED');

    // Verify Notification document generated with user timezone metadata
    const notif = await Notification.findOne({ recipient: user._id });
    expect(notif).not.toBeNull();
    expect(notif.type).toEqual('TASK_REMINDER');
    expect(notif.metadata.userTimezone).toEqual('America/New_York');
  });
});
