const request = require('supertest');
const { app } = require('../server');
const mongoose = require('mongoose');

require('./setup');

describe('Friend System Edge Cases Tests', () => {
  let user1Token, user1Id, user2Token, user2Id;

  beforeEach(async () => {
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'friend1', password: 'password123' });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ username: 'friend2', password: 'password123' });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  it('should return 404 when sending friend request to non-existent user ID', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/friends/request/${fakeId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.error).toEqual('Recipient user not found.');
  });

  it('should return 400 when user attempts self-friend request', async () => {
    const res = await request(app)
      .post(`/api/friends/request/${user1Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('cannot send a friend request to yourself');
  });

  it('should return 400 when accepting request without pending status', async () => {
    const res = await request(app)
      .put(`/api/friends/accept/${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain('No pending friend request found');
  });

  it('should handle special characters in user search query safely (regex escaping)', async () => {
    const res = await request(app)
      .get('/api/friends/search?query=friend[1(')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toEqual(true);
  });
});
