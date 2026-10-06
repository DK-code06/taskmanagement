const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const User = require('../models/User');
const GitHubConnection = require('../models/GitHubConnection');
const GitHubRepositoryLink = require('../models/GitHubRepositoryLink');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');
const { encryptToken } = require('../services/encryptionService');

require('./setup');

const originalFetch = global.fetch;

async function createTestUser(username) {
  const user = new User({ username, password: 'password123' });
  await user.save();
  const token = jwt.sign(
    { id: user._id.toString(), username: user.username },
    process.env.JWT_SECRET || 'testsecret'
  );
  return { token, userId: user._id.toString(), user };
}

describe('Phase 2-H Milestone 2: GitHub Repository Discovery, Linking & IDOR Security Tests', () => {
  let adminToken, adminUserId, memberToken, memberUserId, strangerToken, strangerUserId;
  let projectId, strangerProjectId;
  const encryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  afterEach(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    global.fetch = originalFetch;
    process.env.GITHUB_CLIENT_ID = 'test_github_client_id';
    process.env.GITHUB_CLIENT_SECRET = 'test_github_client_secret';
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = encryptionKey;

    await User.deleteMany({});
    await GitHubConnection.deleteMany({});
    await GitHubRepositoryLink.deleteMany({});
    await Project.deleteMany({});
    await AuditLog.deleteMany({});

    // Admin / Owner User
    const admin = await createTestUser('repoadmin');
    adminToken = admin.token;
    adminUserId = admin.userId;

    // Project Member User (non-admin)
    const member = await createTestUser('repomember');
    memberToken = member.token;
    memberUserId = member.userId;

    // Stranger User (unauthorized)
    const stranger = await createTestUser('repostranger');
    strangerToken = stranger.token;
    strangerUserId = stranger.userId;

    // Create Main Project owned by Admin
    const project = await Project.create({
      name: 'GitHub Test Project',
      description: 'Testing repo linking',
      ownerType: 'User',
      ownerId: adminUserId,
      members: [
        { user: adminUserId, role: 'OWNER' },
        { user: memberUserId, role: 'MEMBER' }
      ]
    });
    projectId = project._id.toString();

    // Create Stranger's Project
    const strangerProject = await Project.create({
      name: 'Stranger Project',
      description: 'Stranger project',
      ownerType: 'User',
      ownerId: strangerUserId,
      members: [{ user: strangerUserId, role: 'OWNER' }]
    });
    strangerProjectId = strangerProject._id.toString();

    // Connect Admin's GitHub account
    const encryptedToken = encryptToken('gho_mock_admin_access_token_123', encryptionKey);
    await GitHubConnection.create({
      userId: adminUserId,
      githubUserId: '111111',
      githubUsername: 'octoadmin',
      encryptedAccessToken: encryptedToken,
      scope: 'repo'
    });
  });

  describe('GET /api/github/repositories (Discovery)', () => {
    it('returns 401 Unauthorized for unauthenticated requests', async () => {
      const res = await request(app).get('/api/github/repositories');
      expect(res.status).toBe(401);
    });

    it('returns 404 when user has no connected GitHub account', async () => {
      const res = await request(app)
        .get('/api/github/repositories')
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/No connected GitHub account/);
    });

    it('returns normalized repository list without exposing access tokens', async () => {
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (typeof url === 'string' && url.includes('api.github.com/user/repos')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([
              {
                id: 555123,
                name: 'cool-app',
                full_name: 'octoadmin/cool-app',
                private: true,
                owner: { login: 'octoadmin' },
                default_branch: 'main',
                html_url: 'https://github.com/octoadmin/cool-app',
                description: 'A cool web application'
              }
            ])
          });
        }
        return originalFetch(url, opts);
      });

      const res = await request(app)
        .get('/api/github/repositories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.repositories)).toBe(true);
      expect(res.body.repositories.length).toBe(1);

      const repo = res.body.repositories[0];
      expect(repo.githubRepoId).toBe('555123');
      expect(repo.owner).toBe('octoadmin');
      expect(repo.name).toBe('cool-app');
      expect(repo.fullName).toBe('octoadmin/cool-app');
      expect(repo.private).toBe(true);
      expect(repo.defaultBranch).toBe('main');

      // Security check: ensure tokens are never returned
      expect(JSON.stringify(res.body)).not.toContain('gho_mock_admin_access_token_123');
    });
  });

  describe('POST /api/projects/:projectId/github/repositories (Link Repository)', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/github/repositories`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when non-admin project member attempts to link repo (IDOR protection)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Admin permissions required/);
    });

    it('returns 403 Forbidden when stranger attempts to link repo to another user project (Cross-Project IDOR)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(403);
    });

    it('returns 404 Not Found for non-existent project ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/projects/${fakeId}/github/repositories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(404);
    });

    it('returns 404 Not Found for invalid project ID format', async () => {
      const res = await request(app)
        .post('/api/projects/invalid-mongo-id/github/repositories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(404);
    });

    it('rejects repository link if user has no connected GitHub account', async () => {
      const res = await request(app)
        .post(`/api/projects/${strangerProjectId}/github/repositories`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Connected GitHub account required/);
    });

    it('rejects repository link if server-side GitHub API verification fails (Inaccessible / private repo IDOR protection)', async () => {
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (typeof url === 'string' && url.includes('api.github.com/repos/secretorg/private-repo')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ message: 'Not Found' })
          });
        }
        return originalFetch(url, opts);
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ owner: 'secretorg', name: 'private-repo', githubRepoId: '999999' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/GitHub repository not found or access denied/);
    });

    it('successfully links an accessible GitHub repository and writes AuditLog', async () => {
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (typeof url === 'string' && url.includes('api.github.com/repos/octoadmin/cool-app')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              id: 555123,
              name: 'cool-app',
              full_name: 'octoadmin/cool-app',
              private: false,
              owner: { login: 'octoadmin' },
              default_branch: 'main',
              html_url: 'https://github.com/octoadmin/cool-app'
            })
          });
        }
        return originalFetch(url, opts);
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          owner: 'octoadmin',
          name: 'cool-app',
          githubRepoId: '555123',
          autoCloseOnPRMerge: true
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Repository linked successfully');
      expect(res.body.link.githubRepoId).toBe('555123');
      expect(res.body.link.fullName).toBe('octoadmin/cool-app');

      // Verify stored in MongoDB
      const link = await GitHubRepositoryLink.findOne({ projectId, githubRepoId: '555123' });
      expect(link).not.toBeNull();
      expect(link.owner).toBe('octoadmin');
      expect(link.name).toBe('cool-app');

      // Verify AuditLog written
      const audit = await AuditLog.findOne({ userId: adminUserId, action: 'GITHUB_REPO_LINKED' });
      expect(audit).not.toBeNull();
      expect(audit.details.fullName).toBe('octoadmin/cool-app');
    });

    it('returns 409 Conflict when attempting duplicate link for same project-repository pair', async () => {
      await GitHubRepositoryLink.create({
        projectId,
        githubRepoId: '555123',
        owner: 'octoadmin',
        name: 'cool-app',
        fullName: 'octoadmin/cool-app',
        linkedBy: adminUserId
      });

      global.fetch = jest.fn().mockImplementation((url, opts) => {
        if (typeof url === 'string' && url.includes('api.github.com/repos/octoadmin/cool-app')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              id: 555123,
              name: 'cool-app',
              full_name: 'octoadmin/cool-app',
              owner: { login: 'octoadmin' }
            })
          });
        }
        return originalFetch(url, opts);
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ owner: 'octoadmin', name: 'cool-app', githubRepoId: '555123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already linked to this project/);
    });
  });

  describe('GET /api/projects/:projectId/github/repositories (List Linked Repos)', () => {
    it('allows project members to list linked repositories', async () => {
      await GitHubRepositoryLink.create({
        projectId,
        githubRepoId: '555123',
        owner: 'octoadmin',
        name: 'cool-app',
        fullName: 'octoadmin/cool-app',
        linkedBy: adminUserId
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.repositories)).toBe(true);
      expect(res.body.repositories.length).toBe(1);
      expect(res.body.repositories[0].githubRepoId).toBe('555123');
    });

    it('rejects unauthorized users from viewing linked repositories', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/github/repositories`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/projects/:projectId/github/repositories/:repositoryId (Unlink Repository)', () => {
    let linkId;

    beforeEach(async () => {
      const link = await GitHubRepositoryLink.create({
        projectId,
        githubRepoId: '555123',
        owner: 'octoadmin',
        name: 'cool-app',
        fullName: 'octoadmin/cool-app',
        linkedBy: adminUserId
      });
      linkId = link._id.toString();
    });

    it('returns 403 Forbidden when non-admin member attempts to unlink repository', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/github/repositories/${linkId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 Not Found when unlinking non-existent link ID', async () => {
      const fakeLinkId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/projects/${projectId}/github/repositories/${fakeLinkId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('successfully unlinks repository without deleting Project or GitHub connection', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/github/repositories/${linkId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Repository unlinked successfully');

      // Verify link removed from DB
      const linkInDb = await GitHubRepositoryLink.findById(linkId);
      expect(linkInDb).toBeNull();

      // Verify Project still exists intact
      const proj = await Project.findById(projectId);
      expect(proj).not.toBeNull();

      // Verify GitHubConnection still exists intact
      const conn = await GitHubConnection.findOne({ userId: adminUserId });
      expect(conn).not.toBeNull();

      // Verify AuditLog written
      const audit = await AuditLog.findOne({ userId: adminUserId, action: 'GITHUB_REPO_UNLINKED' });
      expect(audit).not.toBeNull();
      expect(audit.details.githubRepoId).toBe('555123');
    });
  });
});
