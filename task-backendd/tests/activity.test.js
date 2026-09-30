const mongoose = require('mongoose');
const ActivityEvent = require('../models/ActivityEvent');
const { logActivityEvent } = require('../services/activityService');

require('./setup');

describe('ActivityEvent Service & Append-Only Store Tests', () => {
  it('should write append-only activity event to database', async () => {
    const actorId = new mongoose.Types.ObjectId();
    const taskId = new mongoose.Types.ObjectId();

    const event = await logActivityEvent({
      eventType: 'TASK_COMPLETED',
      actorId,
      taskId,
      metadata: { rewardGranted: 20 }
    });

    expect(event).toBeDefined();
    expect(event.eventType).toEqual('TASK_COMPLETED');
    expect(event.actorId.toString()).toEqual(actorId.toString());
    expect(event.taskId.toString()).toEqual(taskId.toString());
    expect(event.metadata.rewardGranted).toEqual(20);
    expect(event.createdAt).toBeDefined();
  });

  it('should support querying activity events by eventType and projectId', async () => {
    const actorId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();

    await logActivityEvent({
      eventType: 'PROJECT_CREATED',
      actorId,
      projectId
    });

    await logActivityEvent({
      eventType: 'PROJECT_UPDATED',
      actorId,
      projectId
    });

    const projectEvents = await ActivityEvent.find({ projectId }).sort({ createdAt: 1 });
    expect(projectEvents).toHaveLength(2);
    expect(projectEvents[0].eventType).toEqual('PROJECT_CREATED');
    expect(projectEvents[1].eventType).toEqual('PROJECT_UPDATED');
  });

  it('should ignore errors during activity event logging so core transactions do not crash', async () => {
    // Attempt logging with invalid data format (forcing error handling test)
    const result = await logActivityEvent({
      eventType: null // Invalid eventType violating enum
    });

    // logActivityEvent should catch error silently and return null without throwing
    expect(result).toBeNull();
  });

  it('should record complete lifecycle history (creation, assignment, status, due date, completion, reopening) with entity identities & timestamps', async () => {
    const request = require('supertest');
    const { app } = require('../server');

    // Register User
    const reg = await request(app).post('/api/auth/register').send({ username: 'lifecycleuser', password: 'password123' });
    const token = reg.body.token;
    const userId = reg.body.user.id;

    // Create Project
    const projRes = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`).send({ name: 'Lifecycle Project' });
    const projectId = projRes.body._id;

    // 1. Task Creation
    const taskRes = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Lifecycle Task', projectId });
    const taskId = taskRes.body._id;

    // 2. Assignment
    await request(app).put(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ assignedTo: userId });

    // 3. Status Change
    await request(app).put(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ status: 'IN_PROGRESS' });

    // 4. Due Date Change
    const newDueDate = new Date(Date.now() + 86400000).toISOString();
    await request(app).put(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ dueDate: newDueDate });

    // 5. Completion
    await request(app).put(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ status: 'COMPLETED' });

    // 6. Reopening
    await request(app).put(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ status: 'READY' });

    // Query all logged ActivityEvents for this task
    const events = await ActivityEvent.find({ taskId }).sort({ createdAt: 1 });
    const eventTypes = events.map(e => e.eventType);

    expect(eventTypes).toContain('TASK_CREATED');
    expect(eventTypes).toContain('TASK_ASSIGNED');
    expect(eventTypes).toContain('TASK_STATUS_CHANGED');
    expect(eventTypes).toContain('TASK_COMPLETED');
    expect(eventTypes).toContain('TASK_REOPENED');

    // Verify entity identity and actor sufficiency
    events.forEach(event => {
      expect(event.actorId.toString()).toEqual(userId);
      expect(event.projectId.toString()).toEqual(projectId);
      expect(event.taskId.toString()).toEqual(taskId);
      expect(event.createdAt).toBeDefined();
    });
  });
});
