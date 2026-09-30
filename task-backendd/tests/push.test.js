const request = require('supertest');
const { app } = require('../server');
const PushSubscription = require('../models/PushSubscription');
const { sendPushToSubscription, getVapidPublicKey } = require('../services/webPushService');

require('./setup');

describe('Web Push Subscription & Delivery Tests', () => {
  let userToken, userId;

  beforeEach(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'pushtestuser', password: 'password123' });
    userToken = regRes.body.token;
    userId = regRes.body.user.id;
  });

  it('should return VAPID public key', async () => {
    const res = await request(app)
      .get('/api/notifications/push/vapid-key')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.publicKey).toBeDefined();
  });

  it('should register multiple push subscriptions for different user devices', async () => {
    // Register desktop subscription
    const sub1 = await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        endpoint: 'https://push.example.com/sub/desktop123',
        keys: { p256dh: 'dummyKey1', auth: 'dummyAuth1' },
        deviceLabel: 'Work Desktop'
      });

    expect(sub1.statusCode).toEqual(201);

    // Register mobile subscription
    const sub2 = await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        endpoint: 'https://push.example.com/sub/mobile456',
        keys: { p256dh: 'dummyKey2', auth: 'dummyAuth2' },
        deviceLabel: 'Personal Phone'
      });

    expect(sub2.statusCode).toEqual(201);

    const userSubs = await PushSubscription.find({ user: userId });
    expect(userSubs).toHaveLength(2);
  });

  it('should remove a push subscription on unsubscribe request', async () => {
    const endpoint = 'https://push.example.com/sub/desktop-remove';

    await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        endpoint,
        keys: { p256dh: 'dummyKey', auth: 'dummyAuth' }
      });

    const unsubRes = await request(app)
      .post('/api/notifications/push/unsubscribe')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ endpoint });

    expect(unsubRes.statusCode).toEqual(200);

    const subAfter = await PushSubscription.findOne({ endpoint });
    expect(subAfter).toBeNull();
  });

  it('should clean up invalid subscription from database when Web Push returns HTTP 410 / 404', async () => {
    const subDoc = new PushSubscription({
      user: userId,
      endpoint: 'https://push.example.com/sub/expired789',
      keys: { p256dh: 'dummyKey', auth: 'dummyAuth' }
    });
    await subDoc.save();

    // Mock webpush.sendNotification to simulate HTTP 410 Gone error
    const webpush = require('web-push');
    const sendSpy = jest.spyOn(webpush, 'sendNotification').mockRejectedValueOnce({
      statusCode: 410,
      message: 'Subscription expired'
    });

    const result = await sendPushToSubscription(subDoc, { title: 'Test', body: 'Test' });

    expect(result.success).toBe(false);
    expect(result.removed).toBe(true);

    const checkSub = await PushSubscription.findById(subDoc._id);
    expect(checkSub).toBeNull(); // Subscription automatically deleted from database

    sendSpy.mockRestore();
  });
});
