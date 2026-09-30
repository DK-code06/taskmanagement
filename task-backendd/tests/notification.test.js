const request = require('supertest');
const { app } = require('../server');
const Notification = require('../models/Notification');
const { sendNotification } = require('../services/notificationService');

require('./setup');

describe('Notification API, Persistence & Authorization Tests', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;

  beforeEach(async () => {
    // Register User 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'notifuser1', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'notifuser2', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  it('should list notifications for authenticated user with pagination', async () => {
    // Create notifications for User 1
    await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task Assigned',
      message: 'You were assigned to task Alpha'
    });

    await sendNotification({
      recipient: user1Id,
      type: 'TASK_COMPLETION',
      title: 'Task Completed',
      message: 'Task Alpha was completed'
    });

    const res = await request(app)
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.pagination.total).toEqual(2);
    expect(res.body.pagination.page).toEqual(1);
  });

  it('should return unread notification count', async () => {
    await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task Assigned',
      message: 'Unread 1'
    });

    await sendNotification({
      recipient: user1Id,
      type: 'TASK_REMINDER',
      title: 'Task Reminder',
      message: 'Unread 2'
    });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.unreadCount).toEqual(2);
  });

  it('should mark single notification as read and prevent IDOR access by another user', async () => {
    const notif = await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task Assigned',
      message: 'User 1 Private Notification'
    });

    // User 2 attempts to mark User 1's notification as read (IDOR attempt)
    const idorRes = await request(app)
      .put(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(idorRes.statusCode).toEqual(403);
    expect(idorRes.body.error).toContain('Access denied');

    // User 1 marks own notification as read
    const validRes = await request(app)
      .put(`/api/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(validRes.statusCode).toEqual(200);
    expect(validRes.body.read).toBe(true);
    expect(validRes.body.readAt).toBeDefined();
  });

  it('should mark all notifications as read for logged-in user', async () => {
    await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task 1',
      message: 'Msg 1'
    });

    await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task 2',
      message: 'Msg 2'
    });

    const markRes = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(markRes.statusCode).toEqual(200);

    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(countRes.body.unreadCount).toEqual(0);
  });

  it('should deduplicate notifications with duplicate deduplicationKey', async () => {
    const dedupKey = 'task-assign-12345';

    const first = await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task Assignment',
      message: 'First attempt',
      deduplicationKey: dedupKey
    });

    const second = await sendNotification({
      recipient: user1Id,
      type: 'TASK_ASSIGNMENT',
      title: 'Task Assignment',
      message: 'Duplicate attempt',
      deduplicationKey: dedupKey
    });

    expect(first._id.toString()).toEqual(second._id.toString());

    const total = await Notification.countDocuments({ recipient: user1Id });
    expect(total).toEqual(1);
  });
});
