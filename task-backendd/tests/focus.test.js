const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const FocusSession = require('../models/FocusSession');

require('./setup');

describe('Phase 2-F Focus Mode Implementation Tests', () => {
  let userToken, userId, secondUserToken, secondUserId, taskId, projectId;

  beforeEach(async () => {
    await FocusSession.deleteMany({});

    // Register User 1
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'focususer1',
      password: 'password123'
    });
    userToken = reg1.body.token;
    userId = reg1.body.user.id;

    // Register User 2 (for IDOR tests)
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'focususer2',
      password: 'password123'
    });
    secondUserToken = reg2.body.token;
    secondUserId = reg2.body.user.id;

    // Create Project & Task for User 1
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Focus Test Project' });
    projectId = projRes.body._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Focus Test Task',
        description: 'Deep focus work session test.',
        project: projectId,
        priority: 'High',
        estimatedMinutes: 60
      });
    taskId = taskRes.body._id;
  });

  describe('POST /api/focus/sessions (Start Session)', () => {
    it('starts a new focus session for an authorized task', async () => {
      const res = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.status).toBe('ACTIVE');
      expect(res.body.session.taskId._id.toString()).toBe(taskId.toString());
      expect(res.body.elapsedSeconds).toBe(0);
    });

    it('returns 403 access denied if user is not authorized to access task (IDOR)', async () => {
      const res = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ taskId });

      expect(res.status).toBe(403);
    });

    it('returns 409 Conflict if user already has an active session (Single Active Session Policy)', async () => {
      // First session
      await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      // Second start attempt
      const res = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/active focus session already exists/i);
    });
  });

  describe('GET /api/focus/sessions/active', () => {
    it('returns null when user has no active focus session', async () => {
      const res = await request(app)
        .get('/api/focus/sessions/active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.activeSession).toBeNull();
    });

    it('returns active session and server-authoritative elapsedSeconds', async () => {
      await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      const res = await request(app)
        .get('/api/focus/sessions/active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.activeSession).toBeDefined();
      expect(res.body.activeSession.status).toBe('ACTIVE');
      expect(typeof res.body.elapsedSeconds).toBe('number');
    });
  });

  describe('Pause & Resume Lifecycle (`POST /pause` & `POST /resume`)', () => {
    it('pauses an active session and computes accumulatedFocusedSeconds', async () => {
      const startRes = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      const sessionId = startRes.body.session._id;

      const pauseRes = await request(app)
        .post(`/api/focus/sessions/${sessionId}/pause`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.session.status).toBe('PAUSED');
      expect(pauseRes.body.session.pauseCount).toBe(1);
    });

    it('resumes a paused session', async () => {
      const startRes = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      const sessionId = startRes.body.session._id;

      await request(app)
        .post(`/api/focus/sessions/${sessionId}/pause`)
        .set('Authorization', `Bearer ${userToken}`);

      const resumeRes = await request(app)
        .post(`/api/focus/sessions/${sessionId}/resume`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.session.status).toBe('ACTIVE');
    });

    it('prevents user from mutating another user session (IDOR protection)', async () => {
      const startRes = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      const sessionId = startRes.body.session._id;

      const pauseRes = await request(app)
        .post(`/api/focus/sessions/${sessionId}/pause`)
        .set('Authorization', `Bearer ${secondUserToken}`);

      expect(pauseRes.status).toBe(403);
    });
  });

  describe('Completion & Task actualMinutes Idempotency', () => {
    it('completes a session and updates Task.actualMinutes idempotently', async () => {
      const startRes = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      const sessionId = startRes.body.session._id;

      // Manually inject 300 seconds (5 mins) focused time for testing
      await FocusSession.findByIdAndUpdate(sessionId, { accumulatedFocusedSeconds: 300 });

      const taskBefore = await Task.findById(taskId);
      const initialActual = taskBefore.actualMinutes || 0;

      const completeRes = await request(app)
        .post(`/api/focus/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.session.status).toBe('COMPLETED');
      expect(completeRes.body.addedMinutes).toBe(5);

      const taskAfter = await Task.findById(taskId);
      expect(taskAfter.actualMinutes).toBe(initialActual + 5);

      // Duplicate Completion Attempt (Idempotency Test)
      const duplicateRes = await request(app)
        .post(`/api/focus/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(duplicateRes.status).toBe(400);
      expect(duplicateRes.body.error).toMatch(/already been completed/i);

      // Verify task.actualMinutes was NOT double counted
      const taskAfterDuplicate = await Task.findById(taskId);
      expect(taskAfterDuplicate.actualMinutes).toBe(initialActual + 5);
    });
  });

  describe('Cancel Session (`POST /cancel`)', () => {
    it('cancels an active session without adding minutes to Task', async () => {
      const startRes = await request(app)
        .post('/api/focus/sessions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ taskId });

      const sessionId = startRes.body.session._id;

      const cancelRes = await request(app)
        .post(`/api/focus/sessions/${sessionId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.session.status).toBe('CANCELLED');
    });
  });
});
