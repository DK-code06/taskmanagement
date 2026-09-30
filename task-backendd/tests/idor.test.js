const request = require('supertest');
const { app } = require('../server');
const Category = require('../models/Category');
const Task = require('../models/Task');
const Team = require('../models/Team');

require('./setup');

describe('IDOR & Resource Authorization Tests', () => {
  let userAToken, userBToken, userAId, userBId, userACategoryId, userATaskId, teamId;

  beforeEach(async () => {
    // User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ username: 'usera', password: 'password123' });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ username: 'userb', password: 'password123' });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // User A Category
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'User A Category', ownerType: 'User', ownerId: userAId });
    userACategoryId = catRes.body._id;

    // User A Task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: 'User A Secret Task', categoryId: userACategoryId });
    userATaskId = taskRes.body._id;

    // Team created by User A
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Alpha Team' });
    teamId = teamRes.body._id;
  });

  it('should block User B from updating User A task (IDOR prevention)', async () => {
    const res = await request(app)
      .put(`/api/tasks/${userATaskId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('should block User B from deleting User A task (IDOR prevention)', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${userATaskId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.statusCode).toEqual(403);

    // Verify task still exists in DB
    const task = await Task.findById(userATaskId);
    expect(task).not.toBeNull();
  });

  it('should block User B from deleting User A category (IDOR prevention)', async () => {
    const res = await request(app)
      .delete(`/api/categories/${userACategoryId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.statusCode).toEqual(403);
  });

  it('should block User B from viewing Team A analytics if not a team member', async () => {
    const res = await request(app)
      .get(`/api/analytics/team/${teamId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('not a member');
  });

  it('should allow team member to view team analytics', async () => {
    const res = await request(app)
      .get(`/api/analytics/team/${teamId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.totalTasks).toBeDefined();
  });
});
