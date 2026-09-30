const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendNotification } = require('../services/notificationService');

require('./setup');

describe('Offline & Background Chat Notification Tests', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;

  beforeEach(async () => {
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'chatuser1', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'chatuser2', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  it('should dispatch background chat notification when chat message is sent to offline recipient', async () => {
    const notif = await sendNotification({
      recipient: user2Id,
      type: 'CHAT_MESSAGE',
      title: 'Message from chatuser1',
      message: 'Hey chatuser2, check this out!',
      actor: user1Id,
      deduplicationKey: 'chat-msg-99999'
    });

    expect(notif).not.toBeNull();
    expect(notif.recipient.toString()).toEqual(user2Id);
    expect(notif.type).toEqual('CHAT_MESSAGE');
    expect(notif.read).toBe(false);
  });
});
