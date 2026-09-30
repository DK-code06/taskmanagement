const request = require('supertest');
const { app } = require('../server');
const User = require('../models/User');

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

  it('should authenticate valid login and return access token', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'password123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
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

  it('should invalidate all active sessions when calling logout-all', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', password: 'password123' });

    const token = regRes.body.token;

    // Verify access to protected route works
    const certRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(certRes.statusCode).toEqual(200);

    // Call logout-all
    const logoutRes = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.statusCode).toEqual(200);

    // Old token must now be rejected with 401
    const invalidRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(invalidRes.statusCode).toEqual(401);
    expect(invalidRes.body.error).toContain('Session has been invalidated');
  });
});
