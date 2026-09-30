const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const RewardEvent = require('../models/RewardEvent');

require('./setup');

describe('Gamification & Reward Idempotency Tests', () => {
  let userToken, userId, categoryId, taskId;

  beforeEach(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'gamer', password: 'password123' });
    userToken = regRes.body.token;
    userId = regRes.body.user.id;

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Gaming Tasks', ownerType: 'User', ownerId: userId });
    categoryId = catRes.body._id;

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Complete Quest', categoryId });
    taskId = taskRes.body._id;
  });

  it('should award points upon completing a task for the first time', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.completed).toEqual(true);
    expect(res.body.rewardGranted).toEqual(true);

    const user = await User.findById(userId);
    expect(user.points).toBeGreaterThan(0);
  });

  it('should NOT award duplicate points when unchecking and re-completing the task (Idempotency)', async () => {
    // 1st Completion
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const userAfterFirst = await User.findById(userId);
    const initialPoints = userAfterFirst.points;

    // Uncheck Task (reopen)
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'To Do' });

    // 2nd Completion
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const userAfterSecond = await User.findById(userId);
    expect(userAfterSecond.points).toEqual(initialPoints);

    // Verify RewardEvent contains exactly 1 entry for this task
    const events = await RewardEvent.find({ taskId });
    expect(events.length).toEqual(1);
  });

  it('should preserve streak count on multiple same-day completions', async () => {
    // Task 1 Completion
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const user1 = await User.findById(userId);
    expect(user1.streak).toEqual(1);

    // Create Task 2 and complete on same day
    const task2Res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Quest 2', categoryId });

    await request(app)
      .put(`/api/tasks/${task2Res.body._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'Done' });

    const user2 = await User.findById(userId);
    expect(user2.streak).toEqual(1); // Preserves streak 1, does NOT reset to 1
  });
});
