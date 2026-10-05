const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const ActivityEvent = require('../models/ActivityEvent');
const Project = require('../models/Project');
const { getActivitySummary, getProjectActivityMetrics, logActivityEvent } = require('../services/activityService');

require('./setup');

describe('Phase 2-B Intelligence Infrastructure & Activity Summary Tests', () => {
  let memberToken, memberId, nonMemberToken, nonMemberId, projectId, secondProjectId;

  beforeEach(async () => {
    // Register Member User
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'projmember',
      password: 'password123'
    });
    memberToken = reg1.body.token;
    memberId = reg1.body.user.id;

    // Register Non-Member User
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'projnonmember',
      password: 'password123'
    });
    nonMemberToken = reg2.body.token;
    nonMemberId = reg2.body.user.id;

    // Create Project owned by member
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Intelligence Test Project' });
    projectId = projRes.body._id;

    // Create Second Project
    const proj2Res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Other Project' });
    secondProjectId = proj2Res.body._id;

    // Clear ActivityEvent collection so tests start clean without initial PROJECT_CREATED events
    await ActivityEvent.deleteMany({});
  });

  describe('Compound Index & Append-Only Verification', () => {
    it('should have the expected compound index on ActivityEvent model', () => {
      const indexes = ActivityEvent.schema.indexes();
      const hasCompoundIndex = indexes.some(([indexSpec]) => {
        return (
          indexSpec.projectId === 1 &&
          indexSpec.eventType === 1 &&
          indexSpec.createdAt === -1
        );
      });
      expect(hasCompoundIndex).toBe(true);
    });

    it('should preserve append-only history when multiple activity events are recorded', async () => {
      await logActivityEvent({
        eventType: 'TASK_CREATED',
        actorId: memberId,
        projectId
      });

      await logActivityEvent({
        eventType: 'TASK_COMPLETED',
        actorId: memberId,
        projectId
      });

      const events = await ActivityEvent.find({ projectId }).sort({ createdAt: 1 });
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('TASK_CREATED');
      expect(events[1].eventType).toBe('TASK_COMPLETED');
    });
  });

  describe('Service Layer: getActivitySummary and getProjectActivityMetrics', () => {
    it('should calculate deterministic project activity metrics over time window', async () => {
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_COMPLETED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'SUBTASK_CREATED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'SUBTASK_COMPLETED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_STATUS_CHANGED', actorId: memberId, projectId });

      const metrics = await getProjectActivityMetrics({ projectId, timeWindowDays: 30 });

      expect(metrics).toBeDefined();
      expect(metrics.totalEvents).toBe(6);
      expect(metrics.tasksCreated).toBe(2);
      expect(metrics.tasksCompleted).toBe(1);
      expect(metrics.subtasksCreated).toBe(1);
      expect(metrics.subtasksCompleted).toBe(1);
      expect(metrics.statusChanges).toBe(1);
      expect(metrics.byEventType.TASK_CREATED).toBe(2);
      expect(metrics.activeActors).toContain(memberId.toString());
    });

    it('should isolate metrics by project ID', async () => {
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId: secondProjectId });

      const metrics1 = await getProjectActivityMetrics({ projectId, timeWindowDays: 30 });
      const metrics2 = await getProjectActivityMetrics({ projectId: secondProjectId, timeWindowDays: 30 });

      expect(metrics1.totalEvents).toBe(1);
      expect(metrics2.totalEvents).toBe(1);
    });

    it('should filter activity summary by eventType and limit', async () => {
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_COMPLETED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_STATUS_CHANGED', actorId: memberId, projectId });

      const summary = await getActivitySummary({
        projectId,
        eventTypes: ['TASK_COMPLETED', 'TASK_STATUS_CHANGED'],
        limit: 10
      });

      expect(summary).toHaveLength(2);
      const types = summary.map(e => e.eventType);
      expect(types).toContain('TASK_COMPLETED');
      expect(types).toContain('TASK_STATUS_CHANGED');
      expect(types).not.toContain('TASK_CREATED');
    });

    it('should return empty metrics/summary when projectId is missing or invalid', async () => {
      const summary = await getActivitySummary({ projectId: null });
      expect(summary).toEqual([]);

      const metrics = await getProjectActivityMetrics({ projectId: null });
      expect(metrics).toBeNull();
    });
  });

  describe('REST Endpoint: GET /api/projects/:id/activity-summary', () => {
    it('should allow project members to retrieve project activity summary', async () => {
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId });

      const res = await request(app)
        .get(`/api/projects/${projectId}/activity-summary`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projectId).toBe(projectId);
      expect(res.body.projectName).toBe('Intelligence Test Project');
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.totalEvents).toBe(1);
      expect(res.body.recentActivity).toHaveLength(1);
    });

    it('should deny non-members with 403 (IDOR prevention)', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/activity-summary`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/activity-summary`);

      expect(res.status).toBe(401);
    });

    it('should support timeWindowDays, limit, and eventTypes query parameters', async () => {
      await logActivityEvent({ eventType: 'TASK_CREATED', actorId: memberId, projectId });
      await logActivityEvent({ eventType: 'TASK_COMPLETED', actorId: memberId, projectId });

      const res = await request(app)
        .get(`/api/projects/${projectId}/activity-summary?timeWindowDays=7&limit=1&eventTypes=TASK_COMPLETED`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.recentActivity).toHaveLength(1);
      expect(res.body.recentActivity[0].eventType).toBe('TASK_COMPLETED');
    });
  });
});
