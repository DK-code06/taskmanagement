const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../server');
const GitHubConnection = require('../models/GitHubConnection');
const AuditLog = require('../models/AuditLog');
const { generateOAuthState, verifyOAuthState } = require('../routes/github');
const { decryptToken } = require('../services/encryptionService');

require('./setup');

describe('Phase 2-H Milestone 1: GitHub OAuth & Security Foundation Tests', () => {
  let userToken, userId, secondUserToken, secondUserId;
  const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    process.env.GITHUB_CLIENT_ID = 'test_github_client_id';
    process.env.GITHUB_CLIENT_SECRET = 'test_github_client_secret';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = encryptionKey;

    await GitHubConnection.deleteMany({});
    await AuditLog.deleteMany({});

    // Register User 1
    const reg1 = await request(app).post('/api/auth/register').send({
      username: 'ghuser1',
      password: 'password123'
    });
    userToken = reg1.body.token;
    userId = reg1.body.user.id;

    // Register User 2 (for duplicate account linking / collision tests)
    const reg2 = await request(app).post('/api/auth/register').send({
      username: 'ghuser2',
      password: 'password123'
    });
    secondUserToken = reg2.body.token;
    secondUserId = reg2.body.user.id;
  });

  describe('HMAC-SHA256 OAuth CSRF State Parameter Guard', () => {
    it('generates a valid OAuth state and verifies it successfully', () => {
      const state = generateOAuthState(userId);
      expect(typeof state).toBe('string');
      expect(state.split(':').length).toBe(4);

      const isValid = verifyOAuthState(state, userId);
      expect(isValid).toBe(true);
    });

    it('rejects state parameter if userId does not match', () => {
      const state = generateOAuthState(userId);
      const isValid = verifyOAuthState(state, secondUserId);
      expect(isValid).toBe(false);
    });

    it('rejects state parameter if signature is tampered with', () => {
      const state = generateOAuthState(userId);
      const parts = state.split(':');
      parts[3] = '0'.repeat(64); // Tamper signature
      const tamperedState = parts.join(':');

      const isValid = verifyOAuthState(tamperedState, userId);
      expect(isValid).toBe(false);
    });

    it('rejects state parameter if timestamp is expired (> 10 minutes)', () => {
      const secret = process.env.GITHUB_CLIENT_SECRET;
      const crypto = require('crypto');
      const expiredTimestamp = Date.now() - (11 * 60 * 1000); // 11 minutes ago
      const nonce = 'abcdef1234567890';
      const payload = `${userId}:${expiredTimestamp}:${nonce}`;
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const expiredState = `${payload}:${signature}`;

      const isValid = verifyOAuthState(expiredState, userId);
      expect(isValid).toBe(false);
    });
  });

  describe('GET /api/github/connect', () => {
    it('returns 500 if GITHUB_CLIENT_ID is not configured', async () => {
      delete process.env.GITHUB_CLIENT_ID;

      const res = await request(app)
        .get('/api/github/connect')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/GITHUB_CLIENT_ID is missing/);
    });

    it('returns authorization URL and CSRF state parameter', async () => {
      const res = await request(app)
        .get('/api/github/connect')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.url).toContain('https://github.com/login/oauth/authorize');
      expect(res.body.url).toContain('client_id=test_github_client_id');
      expect(res.body.state).toBeDefined();
    });

    it('redirects to GitHub OAuth URL when redirect=true query is passed', async () => {
      const res = await request(app)
        .get('/api/github/connect?redirect=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('https://github.com/login/oauth/authorize');
    });
  });

  describe('GET /api/github/callback', () => {
    let origFetch;

    beforeEach(() => {
      origFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = origFetch;
    });

    it('returns 400 when authorization code or state is missing', async () => {
      const res = await request(app)
        .get('/api/github/callback')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when state parameter is invalid or forged', async () => {
      const res = await request(app)
        .get('/api/github/callback?code=mock_code&state=invalid_forged_state')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid or expired OAuth state/);
    });

    it('successfully connects GitHub account when code exchange succeeds', async () => {
      const validState = generateOAuthState(userId);

      // Mock GitHub API responses
      global.fetch = jest.fn().mockImplementation((url) => {
        if (url === 'https://github.com/login/oauth/access_token') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              access_token: 'gho_mock_access_token_12345',
              scope: 'repo'
            })
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 98765432,
              login: 'octocat'
            })
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      });

      const res = await request(app)
        .get(`/api/github/callback?code=valid_code&state=${encodeURIComponent(validState)}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('GitHub account connected successfully');
      expect(res.body.connection.githubUsername).toBe('octocat');

      // Verify connection saved in MongoDB
      const connection = await GitHubConnection.findOne({ userId });
      expect(connection).not.toBeNull();
      expect(connection.githubUsername).toBe('octocat');
      expect(connection.githubUserId).toBe('98765432');

      // Verify token is encrypted in MongoDB (AES-256-GCM)
      expect(connection.encryptedAccessToken).not.toBe('gho_mock_access_token_12345');
      const decrypted = decryptToken(connection.encryptedAccessToken, encryptionKey);
      expect(decrypted).toBe('gho_mock_access_token_12345');

      // Verify AuditLog written
      const audit = await AuditLog.findOne({ userId, action: 'GITHUB_CONNECTED' });
      expect(audit).not.toBeNull();
      expect(audit.details.githubUsername).toBe('octocat');
    });

    it('returns 409 Conflict if GitHub account is already connected to another user', async () => {
      // First link github user 98765432 to User 2
      await GitHubConnection.create({
        userId: secondUserId,
        githubUserId: '98765432',
        githubUsername: 'octocat',
        encryptedAccessToken: 'iv:tag:cipher',
        scope: 'repo'
      });

      const validState = generateOAuthState(userId);

      global.fetch = jest.fn().mockImplementation((url) => {
        if (url === 'https://github.com/login/oauth/access_token') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: 'gho_mock_token_2', scope: 'repo' })
          });
        }
        if (url === 'https://api.github.com/user') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 98765432, login: 'octocat' })
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      });

      const res = await request(app)
        .get(`/api/github/callback?code=valid_code&state=${encodeURIComponent(validState)}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already connected to a different user/);
    });
  });

  describe('GET /api/github/status', () => {
    it('returns connected: false when user has no GitHub connection', async () => {
      const res = await request(app)
        .get('/api/github/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    it('returns connection details without exposing access tokens when connected', async () => {
      await GitHubConnection.create({
        userId,
        githubUserId: '123456',
        githubUsername: 'testdev',
        encryptedAccessToken: 'iv:tag:cipher',
        scope: 'repo'
      });

      const res = await request(app)
        .get('/api/github/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.githubUsername).toBe('testdev');
      expect(res.body.scope).toBe('repo');
      expect(res.body.encryptedAccessToken).toBeUndefined();
      expect(res.body.accessToken).toBeUndefined();
    });
  });

  describe('POST /api/github/disconnect', () => {
    it('returns 404 when disconnecting a non-existent connection', async () => {
      const res = await request(app)
        .post('/api/github/disconnect')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('No connected GitHub account found');
    });

    it('successfully disconnects connected GitHub account and writes AuditLog', async () => {
      await GitHubConnection.create({
        userId,
        githubUserId: '123456',
        githubUsername: 'testdev',
        encryptedAccessToken: 'iv:tag:cipher',
        scope: 'repo'
      });

      const res = await request(app)
        .post('/api/github/disconnect')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('GitHub account disconnected successfully');

      // Verify connection removed from DB
      const connection = await GitHubConnection.findOne({ userId });
      expect(connection).toBeNull();

      // Verify AuditLog logged
      const audit = await AuditLog.findOne({ userId, action: 'GITHUB_DISCONNECTED' });
      expect(audit).not.toBeNull();
      expect(audit.details.githubUsername).toBe('testdev');
    });
  });
});
