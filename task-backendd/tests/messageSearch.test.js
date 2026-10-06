const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');
const Message = require('../models/Message');

require('./setup');

describe('Phase 2-G Secure Message Search Tests', () => {
  let user1Token, user1Id, user2Token, user2Id, user3Token, user3Id, msg1Id, msg2Id, msg3Id;

  beforeEach(async () => {
    await Message.deleteMany({});

    // Register User 1
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'msguser1',
      password: 'password123'
    });
    user1Token = reg1.body.token;
    user1Id = reg1.body.user.id;

    // Register User 2
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'msguser2',
      password: 'password123'
    });
    user2Token = reg2.body.token;
    user2Id = reg2.body.user.id;

    // Register User 3 (unrelated user for IDOR testing)
    const reg3 = await request(app).post('/api/auth/register').send({
      username: 'msguser3',
      password: 'password123'
    });
    user3Token = reg3.body.token;
    user3Id = reg3.body.user.id;

    // Establish friendship between User 1 and User 2
    await request(app).post(`/api/friends/request/${user2Id}`).set('Authorization', `Bearer ${user1Token}`);
    await request(app).put(`/api/friends/accept/${user1Id}`).set('Authorization', `Bearer ${user2Token}`);

    // Create DMs between User 1 and User 2
    const m1 = new Message({
      fromUser: user1Id,
      toUser: user2Id,
      content: 'The backend deployment pipeline passed all unit tests successfully.'
    });
    await m1.save();
    msg1Id = m1._id;

    const m2 = new Message({
      fromUser: user2Id,
      toUser: user1Id,
      content: 'Great news! Ready to launch deployment to staging.'
    });
    await m2.save();
    msg2Id = m2._id;

    // Create DM between User 3 and User 2
    const m3 = new Message({
      fromUser: user3Id,
      toUser: user2Id,
      content: 'Deployment status update for secondary team.'
    });
    await m3.save();
    msg3Id = m3._id;

    // Ensure MongoDB text index is created
    await Message.createIndexes();
  });

  describe('Query Validation & Error Handling', () => {
    it('returns 400 when search query q is missing or empty', async () => {
      const res = await request(app)
        .get('/api/messages/search?q=')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/query/i);
    });

    it('returns 400 when search query q is less than 2 characters', async () => {
      const res = await request(app)
        .get('/api/messages/search?q=a')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 2 characters/i);
    });

    it('returns 400 when search query q exceeds 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await request(app)
        .get(`/api/messages/search?q=${longQuery}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot exceed 100 characters/i);
    });
  });

  describe('Database-Constrained Authorization & IDOR Protection', () => {
    it('allows User 1 to search their own direct messages', async () => {
      const res = await request(app)
        .get('/api/messages/search?q=deployment')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toBeDefined();
      expect(res.body.results.length).toBeGreaterThan(0);

      // Verify all returned messages involve User 1
      res.body.results.forEach((m) => {
        const participantIds = [m.fromUser._id.toString(), m.toUser._id.toString()];
        expect(participantIds).toContain(user1Id.toString());
      });
    });

    it('prevents User 1 from searching messages belonging exclusively to User 2 and User 3 (0% IDOR leakage)', async () => {
      const res = await request(app)
        .get('/api/messages/search?q=secondary')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(0);
    });

    it('prevents malicious user from overriding authorization using arbitrary friendId parameter', async () => {
      // User 1 passes friendId of User 3 (where DMs exist between User 2 and User 3)
      const res = await request(app)
        .get(`/api/messages/search?q=deployment&friendId=${user3Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      // User 1 has no messages with User 3, so result must be 0
      expect(res.body.results.length).toBe(0);
    });
  });

  describe('Historical DM Policy (ADR 8)', () => {
    it('allows historical DM search between participants even after friendship is removed', async () => {
      // Remove friendship between User 1 and User 2
      await User.updateOne({ _id: user1Id }, { $pull: { friends: { user: user2Id } } });
      await User.updateOne({ _id: user2Id }, { $pull: { friends: { user: user1Id } } });

      const res = await request(app)
        .get('/api/messages/search?q=deployment')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination & Data Minimization', () => {
    it('respects limit parameter and returns data-minimized fields', async () => {
      const res = await request(app)
        .get('/api/messages/search?q=deployment&limit=1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);

      const msg = res.body.results[0];
      expect(msg._id).toBeDefined();
      expect(msg.content).toBeDefined();
      expect(msg.fromUser.username).toBeDefined();
      expect(msg.toUser.username).toBeDefined();
      // Ensure no password or internal security tokens are returned
      expect(msg.fromUser.password).toBeUndefined();
    });
  });
});
