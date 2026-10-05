const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Team = require('../models/Team');
const { getUserWorkload, getProjectWorkload, getTeamWorkload, CAPACITY_LABEL } = require('../services/workloadIntelligenceService');

require('./setup');

describe('Phase 2-C Workload Intelligence Unit & Integration Tests', () => {
  let userToken, userId, nonMemberToken, nonMemberId, projectId, teamId;

  beforeEach(async () => {
    // Register Primary User
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'workloaduser',
      password: 'password123'
    });
    userToken = reg1.body.token;
    userId = reg1.body.user.id;

    // Register Non-Member User
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'workloadnonmember',
      password: 'password123'
    });
    nonMemberToken = reg2.body.token;
    nonMemberId = reg2.body.user.id;

    // Create Project owned by primary user
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Workload Test Project' });
    projectId = projRes.body._id;

    // Create Team
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Workload Team' });
    teamId = teamRes.body._id;
  });

  describe('Service Layer: getUserWorkload', () => {
    it('should calculate active task count, estimated workload, and utilization', async () => {
      await Task.create({
        title: 'Task A',
        user: userId,
        assignedTo: userId,
        projectId,
        estimatedMinutes: 600 // 10 hours
      });

      await Task.create({
        title: 'Task B',
        user: userId,
        assignedTo: userId,
        projectId,
        estimatedMinutes: 600 // 10 hours
      });

      const workload = await getUserWorkload(userId);
      expect(workload.activeTaskCount).toBe(2);
      expect(workload.totalEstimatedWorkloadMinutes).toBe(1200);
      expect(workload.totalEstimatedWorkloadHours).toBe(20);
      expect(workload.capacityLabel).toBe(CAPACITY_LABEL);
      expect(workload.capacityUtilizationPercentage).toBe(50); // 1200 / 2400 = 50%
      expect(workload.loadLevel).toBe('NORMAL');
      expect(workload.isOverloaded).toBe(false);
    });

    it('should use 60 minute effort fallback when estimatedMinutes is not provided or 0', async () => {
      await Task.create({
        title: 'Unestimated Task',
        user: userId,
        assignedTo: userId,
        projectId,
        estimatedMinutes: 0
      });

      const workload = await getUserWorkload(userId);
      expect(workload.totalEstimatedWorkloadMinutes).toBe(60);
    });

    it('should flag overload status when capacity utilization exceeds 130%', async () => {
      // 3,600 minutes = 60 hours = 150% utilization of 40h capacity
      await Task.create({
        title: 'Huge Task',
        user: userId,
        assignedTo: userId,
        projectId,
        estimatedMinutes: 3600
      });

      const workload = await getUserWorkload(userId);
      expect(workload.capacityUtilizationPercentage).toBe(150);
      expect(workload.loadLevel).toBe('OVERLOADED');
      expect(workload.isOverloaded).toBe(true);
    });

    it('should flag overload status when overdue high-priority tasks > 3', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86400000 * 2);

      for (let i = 0; i < 4; i++) {
        await Task.create({
          title: `Overdue High Prio ${i}`,
          user: userId,
          assignedTo: userId,
          projectId,
          dueDate: pastDate,
          priority: 'High',
          estimatedMinutes: 60
        });
      }

      const workload = await getUserWorkload(userId, { now });
      expect(workload.overdueHighPriorityCount).toBe(4);
      expect(workload.isOverloaded).toBe(true);
      expect(workload.loadLevel).toBe('OVERLOADED');
    });
  });

  describe('REST Endpoints & Authorization (IDOR)', () => {
    it('GET /api/intelligence/projects/:id/workload - should allow project members', async () => {
      await Task.create({ title: 'Task 1', user: userId, assignedTo: userId, projectId, estimatedMinutes: 120 });

      const res = await request(app)
        .get(`/api/intelligence/projects/${projectId}/workload`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projectId).toBe(projectId.toString());
      expect(res.body.totalProjectWorkloadMinutes).toBe(120);
      expect(res.body.assumedCapacityLabel).toBe(CAPACITY_LABEL);
    });

    it('GET /api/intelligence/projects/:id/workload - should reject non-members with 403', async () => {
      const res = await request(app)
        .get(`/api/intelligence/projects/${projectId}/workload`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/intelligence/users/:id/workload - should allow user to view own workload', async () => {
      const res = await request(app)
        .get(`/api/intelligence/users/${userId}/workload`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(userId.toString());
      expect(res.body.capacityLabel).toBe(CAPACITY_LABEL);
    });

    it('GET /api/intelligence/users/:id/workload - should deny unauthorized cross-user workload lookup with 403', async () => {
      const res = await request(app)
        .get(`/api/intelligence/users/${userId}/workload`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/intelligence/users/:id/overview - should return personal overview for logged-in user', async () => {
      const res = await request(app)
        .get(`/api/intelligence/users/${userId}/overview`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(userId.toString());
      expect(res.body.workload).toBeDefined();
      expect(res.body.debtOverview).toBeDefined();
    });
  });
});
