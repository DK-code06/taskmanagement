const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const RewardEvent = require('../models/RewardEvent');

require('./setup');

describe('Gamification & Reward Policy Tests', () => {
  let userToken, userId, assigneeToken, assigneeId, categoryId, assignedTaskId, unassignedTaskId;

  beforeEach(async () => {
    // Creator user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'creator', password: 'password123' });
    userToken = regRes.body.token;
    userId = regRes.body.user.id;

    // Assignee user
    const assigneeRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'assignee', password: 'password123' });
    assigneeToken = assigneeRes.body.token;
    assigneeId = assigneeRes.body.user.id;

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Gaming Tasks', ownerType: 'User', ownerId: userId });
    categoryId = catRes.body._id;

    // Assigned Task
    const assignedTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Assigned Quest', categoryId, assignedTo: assigneeId });
    assignedTaskId = assignedTaskRes.body._id;

    // Unassigned Task
    const unassignedTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Unassigned Quest', categoryId });
    unassignedTaskId = unassignedTaskRes.body._id;
  });

  it('should award points to assignee upon completing an assigned task', async () => {
    const res = await request(app)
      .put(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.completed).toEqual(true);
    expect(res.body.rewardGranted).toEqual(true);

    const assignee = await User.findById(assigneeId);
    expect(assignee.points).toBeGreaterThan(0);

    const creator = await User.findById(userId);
    expect(creator.points).toEqual(0); // Creator gets 0 points for assigned task completed by assignee
  });

  it('should NOT award points to anyone when completing an UNASSIGNED task (Approved Reward Policy)', async () => {
    const res = await request(app)
      .put(`/api/tasks/${unassignedTaskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.completed).toEqual(true);
    expect(res.body.rewardGranted).toEqual(false); // No reward granted for unassigned task

    const creator = await User.findById(userId);
    expect(creator.points).toEqual(0);

    const rewardEvents = await RewardEvent.find({ taskId: unassignedTaskId });
    expect(rewardEvents.length).toEqual(0);
  });

  it('should NOT award duplicate points when unchecking and re-completing an assigned task (Idempotency)', async () => {
    // 1st Completion
    await request(app)
      .put(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const assigneeAfterFirst = await User.findById(assigneeId);
    const initialPoints = assigneeAfterFirst.points;

    // Uncheck Task (reopen)
    await request(app)
      .put(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'To Do' });

    // 2nd Completion
    await request(app)
      .put(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const assigneeAfterSecond = await User.findById(assigneeId);
    expect(assigneeAfterSecond.points).toEqual(initialPoints);

    const events = await RewardEvent.find({ taskId: assignedTaskId });
    expect(events.length).toEqual(1);
  });

  it('should preserve streak count on multiple same-day completions for assignee', async () => {
    // Task 1 Completion
    await request(app)
      .put(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const assignee1 = await User.findById(assigneeId);
    expect(assignee1.streak).toEqual(1);

    // Create Task 2 assigned to same assignee and complete on same day
    const task2Res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Assigned Quest 2', categoryId, assignedTo: assigneeId });

    await request(app)
      .put(`/api/tasks/${task2Res.body._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const assignee2 = await User.findById(assigneeId);
    expect(assignee2.streak).toEqual(1); // Preserved streak 1, does NOT reset to 1
  });
});
