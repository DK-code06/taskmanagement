const request = require('supertest');
const { app } = require('../server');
const Task = require('../models/Task');
const ActivityEvent = require('../models/ActivityEvent');

require('./setup');

describe('Subtask & Hierarchy Access Authorization Tests', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;
  let parentTaskId;

  beforeEach(async () => {
    // Register User 1 & Create Parent Task
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'subtaskowner', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Parent Feature Task' });
    parentTaskId = taskRes.body._id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'subtaskstranger', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  it('should create a subtask under authorized parent task', async () => {
    const res = await request(app)
      .post(`/api/tasks/${parentTaskId}/subtasks`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Child Subtask 1',
        estimatedMinutes: 45
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.title).toEqual('Child Subtask 1');
    expect(res.body.parentTaskId.toString()).toEqual(parentTaskId);
    expect(res.body.estimatedMinutes).toEqual(45);

    // Verify activity event logged for subtask
    const activities = await ActivityEvent.find({ taskId: res.body._id, eventType: 'SUBTASK_CREATED' });
    expect(activities).toHaveLength(1);
    expect(activities[0].metadata.parentTaskId.toString()).toEqual(parentTaskId);
  });

  it('should reject creating a subtask under unauthenticated / unauthorized parent task', async () => {
    const res = await request(app)
      .post(`/api/tasks/${parentTaskId}/subtasks`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ title: 'Unauthorized Subtask' });

    expect(res.statusCode).toEqual(403);
  });

  it('should list subtasks for an authorized parent task', async () => {
    await request(app)
      .post(`/api/tasks/${parentTaskId}/subtasks`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Sub 1' });

    await request(app)
      .post(`/api/tasks/${parentTaskId}/subtasks`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Sub 2' });

    const res = await request(app)
      .get(`/api/tasks/${parentTaskId}/subtasks`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toEqual('Sub 1');
    expect(res.body[1].title).toEqual('Sub 2');
  });

  it('should reject unauthorized user from listing subtasks', async () => {
    const res = await request(app)
      .get(`/api/tasks/${parentTaskId}/subtasks`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toEqual(403);
  });

  it('should auto-inherit projectId and milestoneId from parent task when creating subtask', async () => {
    // Create Project & Milestone first
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Inherit Project' });
    const projId = projRes.body._id;

    const msRes = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ projectId: projId, title: 'Inherit Milestone' });
    const msId = msRes.body._id;

    const parentRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Parent With Project', projectId: projId, milestoneId: msId });
    const pId = parentRes.body._id;

    const subRes = await request(app)
      .post(`/api/tasks/${pId}/subtasks`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Subtask In Project' });

    expect(subRes.statusCode).toEqual(201);
    expect(subRes.body.projectId.toString()).toEqual(projId);
    expect(subRes.body.milestoneId.toString()).toEqual(msId);
  });
});
