const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const Task = require('../models/Task');
const Project = require('../models/Project');
const ActivityEvent = require('../models/ActivityEvent');
const { calculateTaskDebt, getProjectDebtSummary, getPriorityMultiplier, getClassification } = require('../services/taskDebtService');

require('./setup');

describe('Phase 2-C Task Debt Intelligence Unit & Integration Tests', () => {
  let userToken, userId, projectId, archivedProjectId;

  beforeEach(async () => {
    const reg = await request(app).post('/api/auth/register').send({
      username: 'debttestuser',
      password: 'password123'
    });
    userToken = reg.body.token;
    userId = reg.body.user.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Active Project' });
    projectId = projRes.body._id;

    const archRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Archived Project' });
    archivedProjectId = archRes.body._id;
    await Project.findByIdAndUpdate(archivedProjectId, { status: 'ARCHIVED' });
  });

  describe('Service Unit Tests: calculateTaskDebt', () => {
    it('should return 0 debt for completed tasks', async () => {
      const task = await Task.create({
        title: 'Completed Task',
        user: userId,
        projectId,
        completed: true,
        status: 'COMPLETED',
        dueDate: new Date(Date.now() - 86400000 * 5)
      });

      const res = await calculateTaskDebt(task._id);
      expect(res.debtScore).toBe(0);
      expect(res.classification).toBe('LOW');
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('Task is completed');
    });

    it('should return 0 debt for soft-deleted tasks', async () => {
      const task = await Task.create({
        title: 'Deleted Task',
        user: userId,
        projectId,
        deletedAt: new Date(),
        dueDate: new Date(Date.now() - 86400000 * 10)
      });

      const res = await calculateTaskDebt(task._id);
      expect(res.debtScore).toBe(0);
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('Task is deleted');
    });

    it('should return 0 debt for tasks in archived projects', async () => {
      const task = await Task.create({
        title: 'Archived Task',
        user: userId,
        projectId: archivedProjectId,
        dueDate: new Date(Date.now() - 86400000 * 3)
      });

      const res = await calculateTaskDebt(task._id);
      expect(res.debtScore).toBe(0);
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('Project is archived');
    });

    it('should correctly calculate overdue duration score (8 pts/day, max 40)', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 86400000 * 3);

      const task = await Task.create({
        title: 'Overdue Task',
        user: userId,
        projectId,
        dueDate: threeDaysAgo,
        priority: 'Medium' // 1.0x
      });

      const res = await calculateTaskDebt(task._id, { now });
      expect(res.breakdown.overdueScore).toBe(24); // 3 * 8 = 24
      expect(res.debtScore).toBe(24);
      expect(res.classification).toBe('LOW');
    });

    it('should correctly calculate deadline proximity score for unstarted tasks within 48h', async () => {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 3600000 * 24);

      const task = await Task.create({
        title: 'Urgent Unstarted Task',
        user: userId,
        projectId,
        status: 'READY',
        dueDate: in24Hours,
        priority: 'Medium'
      });

      const res = await calculateTaskDebt(task._id, { now });
      expect(res.breakdown.proximityScore).toBeGreaterThan(0);
      expect(res.breakdown.proximityScore).toBe(7); // Math.floor((48 - 24) / 3.2) = 7
    });

    it('should calculate stagnation score for in-progress tasks stuck > 3 days', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 86400000 * 5);

      const task = await Task.create({
        title: 'Stagnant Task',
        user: userId,
        projectId,
        status: 'IN_PROGRESS',
        startedAt: fiveDaysAgo,
        updatedAt: fiveDaysAgo,
        priority: 'Medium'
      });

      const res = await calculateTaskDebt(task._id, { now });
      expect(res.breakdown.stagnationScore).toBe(8); // (5 - 3) * 4 = 8
    });

    it('should calculate churn score from ActivityEvents (6 pts per reopen, 3 pts per due-date change)', async () => {
      const task = await Task.create({
        title: 'Churn Task',
        user: userId,
        projectId,
        priority: 'Medium'
      });

      await ActivityEvent.create({ eventType: 'TASK_REOPENED', actorId: userId, taskId: task._id, projectId });
      await ActivityEvent.create({ eventType: 'TASK_DUE_DATE_CHANGED', actorId: userId, taskId: task._id, projectId });

      const res = await calculateTaskDebt(task._id);
      expect(res.breakdown.churnScore).toBe(9); // 6 + 3 = 9
      expect(res.signals.reopenCount).toBe(1);
      expect(res.signals.dueDateChangeCount).toBe(1);
    });

    it('should apply priority multipliers correctly and cap score at 100', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 86400000 * 10);

      const task = await Task.create({
        title: 'Severely Overdue High Prio Task',
        user: userId,
        projectId,
        dueDate: tenDaysAgo,
        priority: 'High' // 1.5x
      });

      await ActivityEvent.create({ eventType: 'TASK_REOPENED', actorId: userId, taskId: task._id, projectId });
      await ActivityEvent.create({ eventType: 'TASK_REOPENED', actorId: userId, taskId: task._id, projectId });

      const res = await calculateTaskDebt(task._id, { now });
      // overdue = 40 (max), churn = 12 (2 * 6). Raw total = (40 + 12) * 1.5 = 78
      expect(res.priorityMultiplier).toBe(1.5);
      expect(res.debtScore).toBe(78);
      expect(res.classification).toBe('CRITICAL');
    });

    it('should bound score between 0 and 100', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 86400000 * 30);

      const task = await Task.create({
        title: 'Extreme Debt Task',
        user: userId,
        projectId,
        status: 'BLOCKED',
        startedAt: thirtyDaysAgo,
        updatedAt: thirtyDaysAgo,
        dueDate: thirtyDaysAgo,
        priority: 'High' // 1.5x
      });

      // Add multiple churn events created 30 days ago
      for (let i = 0; i < 5; i++) {
        await ActivityEvent.create({
          eventType: 'TASK_REOPENED',
          actorId: userId,
          taskId: task._id,
          projectId,
          createdAt: thirtyDaysAgo
        });
      }

      const res = await calculateTaskDebt(task._id, { now });
      expect(res.debtScore).toBe(100); // Bounded max 100
      expect(res.classification).toBe('CRITICAL');
    });
  });

  describe('Project Debt Summary', () => {
    it('should calculate project debt summary and aggregate distributions', async () => {
      const now = new Date();
      const overdueDate = new Date(now.getTime() - 86400000 * 4);

      await Task.create({ title: 'Task 1', user: userId, projectId, dueDate: overdueDate, priority: 'High' });
      await Task.create({ title: 'Task 2', user: userId, projectId, completed: true, status: 'Done' });

      const summary = await getProjectDebtSummary(projectId, { now });
      expect(summary.totalTasks).toBe(2);
      expect(summary.activeTasksCount).toBe(1);
      expect(summary.averageDebtScore).toBeGreaterThan(0);
      expect(summary.highDebtTasks).toHaveLength(2);
    });
  });

  describe('REST Endpoint: GET /api/intelligence/tasks/:id/debt', () => {
    it('should return 200 with debt breakdown for task owner', async () => {
      const task = await Task.create({
        title: 'API Debt Task',
        user: userId,
        projectId,
        priority: 'High'
      });

      const res = await request(app)
        .get(`/api/intelligence/tasks/${task._id}/debt`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.taskId).toBe(task._id.toString());
      expect(res.body.debtScore).toBeDefined();
      expect(res.body.breakdown).toBeDefined();
    });

    it('should return 403 when requesting debt of unauthorized task (IDOR protection)', async () => {
      const otherUserReg = await request(app).post('/api/auth/register').send({
        username: 'otheruser',
        password: 'password123'
      });
      const otherToken = otherUserReg.body.token;

      const task = await Task.create({
        title: 'Private Task',
        user: userId,
        projectId
      });

      const res = await request(app)
        .get(`/api/intelligence/tasks/${task._id}/debt`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
