const request = require('supertest');
const { app } = require('../server');
const Project = require('../models/Project');

require('./setup');

describe('Project Analytics & IDOR Protection Tests (M4.5-B)', () => {
  let user1Token, user1Id, user2Token, user2Id, project1Id;

  beforeEach(async () => {
    // User 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'analyticsuser1', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'analyticsuser2', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;

    // Project owned by User 1
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Private Analytics Project', description: 'Internal metrics test' });
    project1Id = projRes.body._id;

    // Add a task under Project 1
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ title: 'Task 1', projectId: project1Id, priority: 'High' });
  });

  it('should allow project owner to fetch project analytics', async () => {
    const res = await request(app)
      .get(`/api/analytics/project/${project1Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.projectName).toBe('Private Analytics Project');
    expect(res.body.totalTasks).toBe(1);
    expect(res.body.completionPercentage).toBe(0);
    expect(res.body.tasksByPriority.High).toBe(1);
  });

  it('should DENY access to unauthorized user (IDOR Protection)', async () => {
    const res = await request(app)
      .get(`/api/analytics/project/${project1Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Access denied for this project');
  });

  it('should return 400 for invalid project ID format', async () => {
    const res = await request(app)
      .get('/api/analytics/project/invalid-id')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(400);
  });

  it('should return 404 if project does not exist', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/analytics/project/${fakeId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(404);
  });
});
