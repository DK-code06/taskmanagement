const request = require('supertest');
const { app } = require('../server');
const Milestone = require('../models/Milestone');
const ActivityEvent = require('../models/ActivityEvent');

require('./setup');

describe('Milestone API & Access Authorization Tests', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;
  let projectId;

  beforeEach(async () => {
    // Register User 1 & Create Project
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'msowner', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Milestone Parent Project' });
    projectId = projRes.body._id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'msstranger', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  it('should create a milestone under authorized project', async () => {
    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        projectId,
        title: 'Sprint 1 Target',
        description: 'Complete initial setup',
        order: 1
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.title).toEqual('Sprint 1 Target');
    expect(res.body.projectId.toString()).toEqual(projectId);
    expect(res.body.status).toEqual('PLANNED');

    // Activity log check
    const activities = await ActivityEvent.find({ milestoneId: res.body._id });
    expect(activities).toHaveLength(1);
    expect(activities[0].eventType).toEqual('MILESTONE_CREATED');
  });

  it('should prevent creating a milestone in an unauthorized project', async () => {
    const res = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        projectId,
        title: 'Unauthorized Milestone'
      });

    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('should fetch milestones for an authorized project', async () => {
    await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ projectId, title: 'M1', order: 1 });

    await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ projectId, title: 'M2', order: 2 });

    const res = await request(app)
      .get(`/api/milestones/project/${projectId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toEqual('M1');
    expect(res.body[1].title).toEqual('M2');
  });

  it('should forbid unauthorized user from fetching milestones', async () => {
    const res = await request(app)
      .get(`/api/milestones/project/${projectId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toEqual(403);
  });

  it('should update milestone and log completion event when status becomes COMPLETED', async () => {
    const msRes = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ projectId, title: 'Beta Launch' });
    const msId = msRes.body._id;

    const updateRes = await request(app)
      .put(`/api/milestones/${msId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ status: 'COMPLETED' });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.status).toEqual('COMPLETED');

    const activities = await ActivityEvent.find({ milestoneId: msId, eventType: 'MILESTONE_COMPLETED' });
    expect(activities).toHaveLength(1);
  });

  it('should soft delete milestone', async () => {
    const msRes = await request(app)
      .post('/api/milestones')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ projectId, title: 'Delete Me' });
    const msId = msRes.body._id;

    const delRes = await request(app)
      .delete(`/api/milestones/${msId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(delRes.statusCode).toEqual(200);
    expect(delRes.body.message).toContain('deleted');

    const ms = await Milestone.findById(msId);
    expect(ms.deletedAt).not.toBeNull();
  });
});
