const request = require('supertest');
const { app } = require('../server');
const NotificationPreference = require('../models/NotificationPreference');
const { sendNotification } = require('../services/notificationService');

require('./setup');

describe('Notification Preference Tests', () => {
  let userToken, userId;

  beforeEach(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'preftestuser', password: 'password123' });
    userToken = regRes.body.token;
    userId = regRes.body.user.id;
  });

  it('should initialize default notification preferences for user', async () => {
    const res = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.taskAssignment.inApp).toBe(true);
    expect(res.body.taskAssignment.push).toBe(true);
    expect(res.body.systemSecurity.inApp).toBe(true);
  });

  it('should update user notification preferences', async () => {
    const updateRes = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        taskAssignment: { inApp: false, push: true },
        chatMessages: { inApp: true, push: false }
      });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.taskAssignment.inApp).toBe(false);
    expect(updateRes.body.taskAssignment.push).toBe(true);
    expect(updateRes.body.chatMessages.push).toBe(false);
  });

  it('should enforce security policy: systemSecurity inApp remains enabled even if payload attempts to disable it', async () => {
    const updateRes = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        systemSecurity: { inApp: false, push: false }
      });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.systemSecurity.inApp).toBe(true); // Immutable security inApp flag
  });

  it('should respect user preferences when dispatching notifications', async () => {
    // Disable inApp and push for taskAssignment
    await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        taskAssignment: { inApp: false, push: false }
      });

    const notif = await sendNotification({
      recipient: userId,
      type: 'TASK_ASSIGNMENT',
      title: 'Disabled Assignment',
      message: 'Should not create inApp notification'
    });

    expect(notif).toBeNull();
  });
});
