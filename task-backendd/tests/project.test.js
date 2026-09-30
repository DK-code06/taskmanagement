const request = require('supertest');
const { app } = require('../server');
const Project = require('../models/Project');
const Team = require('../models/Team');
const ActivityEvent = require('../models/ActivityEvent');

require('./setup');

describe('Project API & Authorization Tests', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;

  beforeEach(async () => {
    // Register User 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'projectowner', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'projectstranger', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  it('should create a personal project successfully', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Personal Alpha',
        description: 'Alpha description',
        tags: ['urgent', 'q4']
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toEqual('Personal Alpha');
    expect(res.body.ownerType).toEqual('User');
    expect(res.body.ownerId.toString()).toEqual(user1Id);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].role).toEqual('OWNER');

    // Verify activity event was logged
    const activities = await ActivityEvent.find({ projectId: res.body._id });
    expect(activities).toHaveLength(1);
    expect(activities[0].eventType).toEqual('PROJECT_CREATED');
  });

  it('should prevent creating a personal project for another user', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Unauthorized Personal',
        ownerType: 'User',
        ownerId: user2Id
      });

    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toContain('only create personal projects for yourself');
  });

  it('should allow team member to create a team project', async () => {
    // Create team with user1 as member
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Dev Ops Team' });
    const teamId = teamRes.body._id;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Infrastructure Redesign',
        ownerType: 'Team',
        ownerId: teamId
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.ownerType).toEqual('Team');
    expect(res.body.ownerId.toString()).toEqual(teamId);
  });

  it('should forbid non-team member from creating a team project', async () => {
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Exclusive Team' });
    const teamId = teamRes.body._id;

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        name: 'Infiltrator Project',
        ownerType: 'Team',
        ownerId: teamId
      });

    expect(res.statusCode).toEqual(403);
  });

  it('should list projects accessible to user', async () => {
    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'User 1 Project' });

    await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ name: 'User 2 Project' });

    const listRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(listRes.statusCode).toEqual(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toEqual('User 1 Project');
  });

  it('should enforce access control on GET /api/projects/:id (IDOR prevention)', async () => {
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Secret Vault' });
    const projId = projRes.body._id;

    // User 2 attempts to get User 1's project
    const getRes = await request(app)
      .get(`/api/projects/${projId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(getRes.statusCode).toEqual(403);
  });

  it('should allow project updates by ADMIN/OWNER and log activity', async () => {
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Phase 1' });
    const projId = projRes.body._id;

    const updateRes = await request(app)
      .put(`/api/projects/${projId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'Phase 1 - Updated', status: 'COMPLETED' });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.name).toEqual('Phase 1 - Updated');
    expect(updateRes.body.status).toEqual('COMPLETED');

    const activities = await ActivityEvent.find({ projectId: projId, eventType: 'PROJECT_UPDATED' });
    expect(activities).toHaveLength(1);
  });

  it('should soft delete (archive) project', async () => {
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ name: 'To Be Archived' });
    const projId = projRes.body._id;

    const delRes = await request(app)
      .delete(`/api/projects/${projId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(delRes.statusCode).toEqual(200);
    expect(delRes.body.message).toContain('archived');

    const project = await Project.findById(projId);
    expect(project.deletedAt).not.toBeNull();
    expect(project.status).toEqual('ARCHIVED');
  });
});
