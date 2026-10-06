const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const Task = require('../models/Task');
const Project = require('../models/Project');
const ActivityEvent = require('../models/ActivityEvent');
const RecommendationState = require('../models/RecommendationState');
const { generateProjectRecommendations, dismissRecommendation } = require('../services/recommendationService');

require('./setup');

describe('Phase 2-D Recommendation Engine & Lifecycle Tests', () => {
  let memberToken, memberId, nonMemberToken, nonMemberId, projectId, secondProjectId;

  beforeEach(async () => {
    // Register Project Member
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'recmember',
      password: 'password123'
    });
    memberToken = reg1.body.token;
    memberId = reg1.body.user.id;

    // Register Non-Member
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'recnonmember',
      password: 'password123'
    });
    nonMemberToken = reg2.body.token;
    nonMemberId = reg2.body.user.id;

    // Create primary project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Recommendation Test Project' });
    projectId = projRes.body._id;

    // Create second project for IDOR tests
    const proj2Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Second Project' });
    secondProjectId = proj2Res.body._id;

    await RecommendationState.deleteMany({});
  });

  describe('Rule Evaluator Unit & Lifecycle Tests', () => {
    it('RULE 1 (REALLOCATE_WORKLOAD): triggers when one member utilization >130% and another <60%', async () => {
      // Register second member
      const reg3 = await request(app).post('/api/auth/register').send({
        username: 'membertwo',
        password: 'password123'
      });
      const memberTwoId = reg3.body.user.id;

      // Add second member to project
      await Project.findByIdAndUpdate(projectId, {
        $push: { members: { user: memberTwoId, role: 'MEMBER' } }
      });

      // Assign 3,600 minutes (60h = 150%) to memberId
      await Task.create({
        title: 'Overload Task',
        user: memberId,
        assignedTo: memberId,
        projectId,
        estimatedMinutes: 3600
      });

      // Assign 60 minutes (1h = 2.5%) to memberTwoId
      await Task.create({
        title: 'Light Task',
        user: memberId,
        assignedTo: memberTwoId,
        projectId,
        estimatedMinutes: 60
      });

      const recs = await generateProjectRecommendations(projectId, memberId);
      const reallocRec = recs.find(r => r.ruleType === 'REALLOCATE_WORKLOAD');

      expect(reallocRec).toBeDefined();
      expect(reallocRec.priority).toBe('HIGH');
      expect(reallocRec.confidence).toBe(0.90);
      expect(reallocRec.isAdvisoryOnly).toBe(true);
    });

    it('RULE 2 (REBREAKDOWN_STAGNANT_TASK): triggers for tasks with debt >= 75 or stagnation > 5 days', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 86400000 * 10);

      const task = await Task.create({
        title: 'Stagnant High Debt Task',
        user: memberId,
        projectId,
        status: 'IN_PROGRESS',
        startedAt: tenDaysAgo,
        updatedAt: tenDaysAgo,
        dueDate: tenDaysAgo,
        priority: 'High'
      });

      const recs = await generateProjectRecommendations(projectId, memberId, { now });
      const breakRec = recs.find(r => r.ruleType === 'REBREAKDOWN_STAGNANT_TASK' && r.entityId === task._id.toString());

      expect(breakRec).toBeDefined();
      expect(breakRec.priority).toBe('HIGH');
      expect(breakRec.confidence).toBe(0.85);
    });

    it('RULE 3 (RESOLVE_BLOCKER): triggers when task status === BLOCKED for > 48 hours', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 86400000 * 3);

      const task = await Task.create({
        title: 'Blocked Task',
        user: memberId,
        projectId,
        status: 'BLOCKED',
        startedAt: threeDaysAgo,
        updatedAt: threeDaysAgo
      });

      const recs = await generateProjectRecommendations(projectId, memberId, { now });
      const blockRec = recs.find(r => r.ruleType === 'RESOLVE_BLOCKER' && r.entityId === task._id.toString());

      expect(blockRec).toBeDefined();
      expect(blockRec.priority).toBe('MEDIUM');
      expect(blockRec.confidence).toBe(0.85);
    });

    it('RULE 4 (ADJUST_DUE_DATE): triggers when task is due < 24h with high debt (>= 50)', async () => {
      const now = new Date();
      const dueIn12h = new Date(now.getTime() + 3600000 * 12);

      const task = await Task.create({
        title: 'Impending Due Task',
        user: memberId,
        projectId,
        status: 'READY',
        dueDate: dueIn12h,
        priority: 'High'
      });

      // Add 4 reopen events to elevate debt above 50 (proximity: 11 + churn: 24 = 35 * 1.5 = 53)
      for (let i = 0; i < 4; i++) {
        await ActivityEvent.create({ eventType: 'TASK_REOPENED', actorId: memberId, taskId: task._id, projectId });
      }

      const recs = await generateProjectRecommendations(projectId, memberId, { now });
      const dueRec = recs.find(r => r.ruleType === 'ADJUST_DUE_DATE' && r.entityId === task._id.toString());

      expect(dueRec).toBeDefined();
      expect(dueRec.priority).toBe('MEDIUM');
      expect(dueRec.confidence).toBe(0.80);
    });

    it('RULE 5 (ARCHIVE_COMPLETED_PROJECT): triggers when project is 100% complete and ACTIVE', async () => {
      await Task.create({
        title: 'Done Task',
        user: memberId,
        projectId,
        completed: true,
        status: 'Done'
      });

      const recs = await generateProjectRecommendations(projectId, memberId);
      const archiveRec = recs.find(r => r.ruleType === 'ARCHIVE_COMPLETED_PROJECT');

      expect(archiveRec).toBeDefined();
      expect(archiveRec.priority).toBe('LOW');
      expect(archiveRec.confidence).toBe(0.95);
    });

    it('Lifecycle DISMISSED: dismissed recommendation does not reappear in active list', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 86400000 * 10);

      const task = await Task.create({
        title: 'Task To Dismiss',
        user: memberId,
        projectId,
        status: 'IN_PROGRESS',
        startedAt: tenDaysAgo,
        updatedAt: tenDaysAgo
      });

      // 1. Initial recommendation list contains task
      const initialRecs = await generateProjectRecommendations(projectId, memberId, { now });
      expect(initialRecs.some(r => r.entityId === task._id.toString())).toBe(true);

      // 2. Dismiss recommendation
      await dismissRecommendation({
        projectId,
        ruleType: 'REBREAKDOWN_STAGNANT_TASK',
        entityId: task._id.toString(),
        userId: memberId
      });

      // 3. Subsequent recommendation list excludes dismissed task
      const filteredRecs = await generateProjectRecommendations(projectId, memberId, { now });
      expect(filteredRecs.some(r => r.entityId === task._id.toString())).toBe(false);
    });

    it('Lifecycle EXPIRED: completed task automatically clears recommendation without manual dismissal', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 86400000 * 10);

      const task = await Task.create({
        title: 'Task To Complete',
        user: memberId,
        projectId,
        status: 'IN_PROGRESS',
        startedAt: tenDaysAgo,
        updatedAt: tenDaysAgo
      });

      const initialRecs = await generateProjectRecommendations(projectId, memberId, { now });
      expect(initialRecs.some(r => r.entityId === task._id.toString())).toBe(true);

      // Complete the task
      await Task.findByIdAndUpdate(task._id, { completed: true, status: 'Done', completedAt: new Date() });

      const postRecs = await generateProjectRecommendations(projectId, memberId, { now });
      expect(postRecs.some(r => r.entityId === task._id.toString())).toBe(false);
    });
  });

  describe('REST Endpoints & IDOR Security', () => {
    it('GET /api/projects/:id/recommendations - returns 200 for authorized project member', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/recommendations`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projectId).toBe(projectId.toString());
      expect(res.body.recommendations).toBeDefined();
    });

    it('GET /api/projects/:id/recommendations - returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/recommendations`);

      expect(res.status).toBe(401);
    });

    it('GET /api/projects/:id/recommendations - returns 403 for non-member user', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/recommendations`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('POST /api/projects/:id/recommendations/:recommendationId/dismiss - allows project member to dismiss', async () => {
      const recId = `rec_${projectId}_ARCHIVE_COMPLETED_PROJECT_${projectId}`;

      const res = await request(app)
        .post(`/api/projects/${projectId}/recommendations/${recId}/dismiss`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ ruleType: 'ARCHIVE_COMPLETED_PROJECT', entityId: projectId.toString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbDismissal = await RecommendationState.findOne({ projectId, ruleType: 'ARCHIVE_COMPLETED_PROJECT' });
      expect(dbDismissal).toBeDefined();
      expect(dbDismissal.status).toBe('DISMISSED');
    });

    it('POST /api/projects/:id/recommendations/:recommendationId/dismiss - rejects non-member with 403 (IDOR Protection)', async () => {
      const recId = `rec_${projectId}_ARCHIVE_COMPLETED_PROJECT_${projectId}`;

      const res = await request(app)
        .post(`/api/projects/${projectId}/recommendations/${recId}/dismiss`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({ ruleType: 'ARCHIVE_COMPLETED_PROJECT', entityId: projectId.toString() });

      expect(res.status).toBe(403);
    });
  });
});
