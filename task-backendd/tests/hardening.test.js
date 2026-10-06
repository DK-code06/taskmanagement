const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const ReminderJob = require('../models/ReminderJob');
const { processPendingReminders } = require('../services/reminderSchedulerService');

require('./setup');

describe('Phase 3-B: Reliability & Array Guard Rail Tests', () => {
  let user, userId, token, project, projectId, task, taskId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Task.deleteMany({});
    await Project.deleteMany({});
    await ReminderJob.deleteMany({});

    user = new User({ username: 'hardeneduser', password: 'password123' });
    await user.save();
    userId = user._id.toString();

    project = await Project.create({
      name: 'Hardening Project',
      ownerType: 'User',
      ownerId: userId,
      members: [{ user: userId, role: 'OWNER' }]
    });
    projectId = project._id.toString();

    task = await Task.create({
      title: 'Comment Limit Test Task',
      projectId,
      user: userId,
      status: 'READY'
    });
    taskId = task._id.toString();
  });

  describe('Atomic Reminder Worker Reservation', () => {
    it('claims due reminder job atomically transitioning PENDING to PROCESSING to EXECUTED', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);

      const job = await ReminderJob.create({
        taskId: taskId,
        userId: userId,
        reminderType: 'DUE_DATE',
        scheduledAt: past,
        status: 'PENDING',
        deduplicationKey: `test:reminder:${taskId}:1`
      });

      const res = await processPendingReminders();
      expect(res.executed).toBe(1);

      const updatedJob = await ReminderJob.findById(job._id);
      expect(updatedJob.status).toBe('EXECUTED');
    });

    it('prevents concurrent worker duplicate processing via atomic status locking', async () => {
      const past = new Date(Date.now() - 10000);

      const job = await ReminderJob.create({
        taskId: taskId,
        userId: userId,
        reminderType: 'DUE_DATE',
        scheduledAt: past,
        status: 'PENDING',
        deduplicationKey: `test:reminder:${taskId}:concurrent`
      });

      // Manually set status to PROCESSING to simulate concurrent worker claim
      await ReminderJob.updateOne({ _id: job._id }, { status: 'PROCESSING' });

      // Worker process call should skip already processing job
      const res = await processPendingReminders();
      expect(res.executed).toBe(0);
    });
  });

  describe('Task Comment Array Guard Rail (Max 200 Comments)', () => {
    it('enforces maximum 200 comments per task guard rail', async () => {
      const taskDoc = await Task.findById(taskId);
      // Fill comments array to 200 items
      for (let i = 0; i < 200; i++) {
        taskDoc.comments.push({ user: userId, content: `Comment ${i}` });
      }
      await taskDoc.save();

      // Attempt to push 201st comment
      const mockUserJwt = require('jsonwebtoken').sign(
        { id: userId, username: 'hardeneduser', sessionVersion: 1 },
        process.env.JWT_SECRET || 'testsecret'
      );

      const res = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${mockUserJwt}`)
        .send({ content: 'Comment 201' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Maximum comment limit \(200\) reached/);
    });
  });

  describe('User Friend Array Guard Rail (Max 500 Friends)', () => {
    it('enforces maximum 500 friends guard rail on user friend requests', async () => {
      const userDoc = await User.findById(userId);
      // Fill friends array to 500 items
      for (let i = 0; i < 500; i++) {
        userDoc.friends.push({ user: new User()._id, status: 'accepted' });
      }
      await userDoc.save();

      const recipient = await User.create({ username: 'recipientuser', password: 'password123' });

      const mockUserJwt = require('jsonwebtoken').sign(
        { id: userId, username: 'hardeneduser', sessionVersion: 1 },
        process.env.JWT_SECRET || 'testsecret'
      );

      const res = await request(app)
        .post(`/api/friends/request/${recipient._id.toString()}`)
        .set('Authorization', `Bearer ${mockUserJwt}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Maximum friend limit \(500\) reached/);
    });
  });
});
