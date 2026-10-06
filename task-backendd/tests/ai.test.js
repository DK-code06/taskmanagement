const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');

require('./setup');

describe('Phase 2-E Opt-In AI Task Decomposition & Summarization Tests', () => {
  let userToken, userId, nonMemberToken, nonMemberId, taskId, projectId;

  beforeEach(async () => {
    // Register primary user
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'aiuser1',
      password: 'password123'
    });
    userToken = reg1.body.token;
    userId = reg1.body.user.id;

    // Register second user (for IDOR tests)
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'aiuser2',
      password: 'password123'
    });
    nonMemberToken = reg2.body.token;
    nonMemberId = reg2.body.user.id;

    // Create project & task for primary user
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'AI Test Project' });
    projectId = projRes.body._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Build API Integration Pipeline',
        description: 'Set up OAuth2 authentication, rate limiting, and error handling for external service integration.',
        project: projectId,
        priority: 'High',
        estimatedMinutes: 120
      });
    taskId = taskRes.body._id;
  });

  describe('GET /api/ai/status', () => {
    it('returns consentRequired status when user has not opted in', async () => {
      const res = await request(app)
        .get('/api/ai/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userConsentEnabled).toBe(false);
      expect(res.body.statusLabel).toBe('CONSENT_REQUIRED');
    });

    it('returns updated status after consent is enabled', async () => {
      await User.findByIdAndUpdate(userId, { aiConsent: true });

      const res = await request(app)
        .get('/api/ai/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userConsentEnabled).toBe(true);
    });
  });

  describe('PUT /api/user/preferences/ai', () => {
    it('requires boolean aiConsent parameter', async () => {
      const res = await request(app)
        .put('/api/user/preferences/ai')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ aiConsent: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/boolean/i);
    });

    it('updates user AI consent preference to true and false', async () => {
      const res1 = await request(app)
        .put('/api/user/preferences/ai')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ aiConsent: true });

      expect(res1.status).toBe(200);
      expect(res1.body.aiConsent).toBe(true);

      const userDoc = await User.findById(userId);
      expect(userDoc.aiConsent).toBe(true);

      const res2 = await request(app)
        .put('/api/user/preferences/ai')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ aiConsent: false });

      expect(res2.status).toBe(200);
      expect(res2.body.aiConsent).toBe(false);
    });
  });

  describe('POST /api/ai/tasks/:id/decompose', () => {
    it('returns 403 consentRequired if user has not opted in', async () => {
      const res = await request(app)
        .post(`/api/ai/tasks/${taskId}/decompose`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.consentRequired).toBe(true);
    });

    it('returns 403 access denied if user is not authorized to access task (IDOR)', async () => {
      await User.findByIdAndUpdate(nonMemberId, { aiConsent: true });

      const res = await request(app)
        .post(`/api/ai/tasks/${taskId}/decompose`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent task ID', async () => {
      await User.findByIdAndUpdate(userId, { aiConsent: true });
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/api/ai/tasks/${fakeId}/decompose`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it('returns subtask suggestions without mutating task or database subtasks (Advisory Only)', async () => {
      await User.findByIdAndUpdate(userId, { aiConsent: true });

      const countBefore = await Task.countDocuments({ parentTask: taskId });

      const res = await request(app)
        .post(`/api/ai/tasks/${taskId}/decompose`)
        .set('Authorization', `Bearer ${userToken}`);

      // Response should either be success (200) or service unavailable fallback (503)
      expect([200, 503]).toContain(res.status);
      expect(res.body.suggestions).toBeDefined();
      expect(Array.isArray(res.body.suggestions)).toBe(true);

      // Verify zero subtasks were created in DB automatically
      const countAfter = await Task.countDocuments({ parentTask: taskId });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('POST /api/ai/tasks/:id/summarize', () => {
    it('returns 403 consentRequired if user has not opted in', async () => {
      const res = await request(app)
        .post(`/api/ai/tasks/${taskId}/summarize`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.consentRequired).toBe(true);
    });

    it('returns executive summary and progress assessment when opted in', async () => {
      await User.findByIdAndUpdate(userId, { aiConsent: true });

      const res = await request(app)
        .post(`/api/ai/tasks/${taskId}/summarize`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 503]).toContain(res.status);
      expect(res.body.summary).toBeDefined();
      expect(res.body.keyTakeaways).toBeDefined();
      expect(Array.isArray(res.body.keyTakeaways)).toBe(true);
    });
  });
});
