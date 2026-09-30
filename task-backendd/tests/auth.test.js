const request = require('supertest');
const { app } = require('../server');
const jwt = require('jsonwebtoken');

require('./setup');

describe('Authentication & Session Hardening Tests', () => {
  it('should register a new user successfully and set refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'password123' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toEqual('alice');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject registration with missing username or password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toBeDefined();
  });

  it('should authenticate valid login and return access token + refresh cookie', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'password123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'charlie', password: 'correctpassword' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'charlie', password: 'wrongpassword' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid credentials');
  });

  it('should issue new access token via /refresh with valid refresh cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'refreshtest', password: 'password123' });

    const cookies = loginRes.headers['set-cookie'];

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(refreshRes.statusCode).toEqual(200);
    expect(refreshRes.body).toHaveProperty('token');
  });

  it('should reject /refresh with invalid or missing refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toContain('missing');
  });

  it('should reject expired access token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'expiretest', password: 'password123' });

    const expiredToken = jwt.sign(
      { id: regRes.body.user.id, username: 'expiretest', sessionVersion: 1 },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Token expired');
  });

  it('should log out user and clear refresh cookie', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'logoutuser', password: 'password123' });

    const token = regRes.body.token;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutRes.statusCode).toEqual(200);
    expect(logoutRes.body.message).toContain('Logged out');
  });

  it('should invalidate all active sessions when calling logout-all', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', password: 'password123' });

    const token = regRes.body.token;

    const certRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(certRes.statusCode).toEqual(200);

    const logoutRes = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.statusCode).toEqual(200);

    const invalidRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(invalidRes.statusCode).toEqual(401);
    expect(invalidRes.body.error).toContain('Session has been invalidated');
  });

  it('should allow changing password and invalidate old tokens via sessionVersion increment', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'pwdchange', password: 'oldpassword123' });

    const oldToken = regRes.body.token;

    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ oldPassword: 'oldpassword123', newPassword: 'newpassword456' });

    expect(changeRes.statusCode).toEqual(200);
    expect(changeRes.body).toHaveProperty('token');

    // Old token must now be rejected
    const testOldToken = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(testOldToken.statusCode).toEqual(401);

    // Login with new password must succeed
    const loginNew = await request(app)
      .post('/api/auth/login')
      .send({ username: 'pwdchange', password: 'newpassword456' });
    expect(loginNew.statusCode).toEqual(200);
  });
});
