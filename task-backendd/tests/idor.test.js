const request = require('supertest');
const { app } = require('../server');

require('./setup');

describe('IDOR & Positive/Negative Resource Authorization Tests', () => {
  let userAToken, userAId, userBToken, userBId, userACategoryId, userATaskId, teamId;

  beforeEach(async () => {
    // User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ username: 'usera', password: 'password123' });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ username: 'userb', password: 'password123' });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // User A Category
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'User A Category', ownerType: 'User', ownerId: userAId });
    userACategoryId = catRes.body._id;

    // User A Task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: 'User A Secret Task', categoryId: userACategoryId });
    userATaskId = taskRes.body._id;

    // Team created by User A
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ name: 'Alpha Team' });
    teamId = teamRes.body._id;
  });

  // TASKS AUTHORIZATION
  it('POSITIVE: User A can view, update, add comments, and delete own task', async () => {
    // View
    const getRes = await request(app)
      .get(`/api/tasks/by-category/${userACategoryId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(getRes.statusCode).toEqual(200);

    // Update
    const putRes = await request(app)
      .put(`/api/tasks/${userATaskId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: 'Updated Title' });
    expect(putRes.statusCode).toEqual(200);

    // Comment
    const commentRes = await request(app)
      .post(`/api/tasks/${userATaskId}/comments`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'Owner comment' });
    expect(commentRes.statusCode).toEqual(201);

    // Delete
    const delRes = await request(app)
      .delete(`/api/tasks/${userATaskId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delRes.statusCode).toEqual(200);
  });

  it('NEGATIVE: User B cannot view, update, comment, or delete User A task (IDOR protection)', async () => {
    // View
    const getRes = await request(app)
      .get(`/api/tasks/by-category/${userACategoryId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(getRes.statusCode).toEqual(403);

    // Update
    const putRes = await request(app)
      .put(`/api/tasks/${userATaskId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ title: 'Hacked Title' });
    expect(putRes.statusCode).toEqual(403);

    // Comment
    const commentRes = await request(app)
      .post(`/api/tasks/${userATaskId}/comments`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ content: 'Malicious comment' });
    expect(commentRes.statusCode).toEqual(403);

    // Delete
    const delRes = await request(app)
      .delete(`/api/tasks/${userATaskId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(delRes.statusCode).toEqual(403);
  });

  // CATEGORIES AUTHORIZATION
  it('POSITIVE & NEGATIVE: Category ownership authorization checks', async () => {
    // User B cannot pin User A category
    const pinRes = await request(app)
      .put(`/api/categories/${userACategoryId}/pin`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(pinRes.statusCode).toEqual(403);

    // User A can pin own category
    const pinResA = await request(app)
      .put(`/api/categories/${userACategoryId}/pin`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(pinResA.statusCode).toEqual(200);

    // User B cannot delete User A category
    const delRes = await request(app)
      .delete(`/api/categories/${userACategoryId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(delRes.statusCode).toEqual(403);
  });

  // TEAMS & TEAM INVITATION AUTHORIZATION
  it('POSITIVE & NEGATIVE: Team membership and invite permissions', async () => {
    // User B cannot view team list of team they are not a member of
    const teamList = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(teamList.statusCode).toEqual(200);
    expect(teamList.body.some(t => t._id === teamId)).toEqual(false);

    // User B cannot invite users to Team A
    const inviteRes = await request(app)
      .put(`/api/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ friendId: userBId });
    expect(inviteRes.statusCode).toEqual(403);
  });

  // ANALYTICS AUTHORIZATION
  it('POSITIVE & NEGATIVE: Analytics authorization', async () => {
    // User B cannot view Team A analytics
    const resB = await request(app)
      .get(`/api/analytics/team/${teamId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(resB.statusCode).toEqual(403);

    // User A (Creator/Admin) can view Team A analytics
    const resA = await request(app)
      .get(`/api/analytics/team/${teamId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(resA.statusCode).toEqual(200);
  });

  // FRIENDS & CHAT AUTHORIZATION
  it('POSITIVE & NEGATIVE: Friend request and chat authorization', async () => {
    // Send friend request User A -> User B
    const reqRes = await request(app)
      .post(`/api/friends/request/${userBId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(reqRes.statusCode).toEqual(200);

    // User B cannot view chat history before accepting friend request
    const chatRes1 = await request(app)
      .get(`/api/friends/chat/${userAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(chatRes1.statusCode).toEqual(403);

    // User B accepts request
    const acceptRes = await request(app)
      .put(`/api/friends/accept/${userAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(acceptRes.statusCode).toEqual(200);

    // Now chat history is allowed
    const chatRes2 = await request(app)
      .get(`/api/friends/chat/${userAId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(chatRes2.statusCode).toEqual(200);
  });
});
