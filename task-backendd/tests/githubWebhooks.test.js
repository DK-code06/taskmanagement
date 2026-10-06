const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const GitHubConnection = require('../models/GitHubConnection');
const GitHubRepositoryLink = require('../models/GitHubRepositoryLink');
const GitHubSyncMapping = require('../models/GitHubSyncMapping');
const GitHubWebhookLog = require('../models/GitHubWebhookLog');
const AuditLog = require('../models/AuditLog');
const { verifyWebhookSignature, extractTaskIdsFromText } = require('../routes/githubWebhooks');

require('./setup');

describe('Phase 2-H Milestone 3: GitHub Webhook Security & PR Synchronization Tests', () => {
  const webhookSecret = 'test_webhook_secret_key_12345';
  let user, userId, project, projectId, taskId, linkedRepoId;

  // Helper to generate HMAC-SHA256 signature for test payloads
  function signPayload(payloadString, secret = webhookSecret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(Buffer.from(payloadString, 'utf8'));
    return 'sha256=' + hmac.digest('hex');
  }

  beforeEach(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;

    await User.deleteMany({});
    await Task.deleteMany({});
    await Project.deleteMany({});
    await GitHubConnection.deleteMany({});
    await GitHubRepositoryLink.deleteMany({});
    await GitHubSyncMapping.deleteMany({});
    await GitHubWebhookLog.deleteMany({});
    await AuditLog.deleteMany({});

    // Create User
    user = new User({ username: 'webhookuser', password: 'password123', points: 100 });
    await user.save();
    userId = user._id.toString();

    // Create Project
    project = await Project.create({
      name: 'Webhook Project',
      ownerType: 'User',
      ownerId: userId,
      members: [{ user: userId, role: 'OWNER' }]
    });
    projectId = project._id.toString();

    // Create Task in Project
    const task = await Task.create({
      title: 'Fix issue with auth flow',
      projectId: projectId,
      user: userId,
      assignedTo: userId,
      status: 'READY',
      completed: false
    });
    taskId = task._id.toString();

    // Create GitHub Repository Link for Project
    linkedRepoId = '987654';
    await GitHubRepositoryLink.create({
      projectId: projectId,
      githubRepoId: linkedRepoId,
      owner: 'testorg',
      name: 'testrepo',
      fullName: 'testorg/testrepo',
      autoCloseOnPRMerge: true,
      linkedBy: userId
    });
  });

  describe('Webhook Signature Verification (HMAC-SHA256)', () => {
    it('accepts valid HMAC SHA-256 signature calculated over raw body', async () => {
      const payloadObj = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: `[TASK-${taskId}] Fix auth flow`,
          body: 'Resolves issue',
          merged: true,
          html_url: 'https://github.com/testorg/testrepo/pull/42'
        },
        repository: { id: 987654, full_name: 'testorg/testrepo' }
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-uuid-001')
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Task auto-completed/);
    });

    it('rejects request when x-hub-signature-256 header is missing (400)', async () => {
      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-github-delivery', 'delivery-uuid-002')
        .send(JSON.stringify({ ping: true }));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing x-hub-signature-256/);
    });

    it('rejects request with invalid or tampered HMAC signature (401)', async () => {
      const rawBody = JSON.stringify({ ping: true });
      const badSignature = 'sha256=' + '0'.repeat(64);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', badSignature)
        .set('x-github-delivery', 'delivery-uuid-003')
        .send(rawBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid HMAC SHA-256/);

      // Verify AuditLog written
      const audit = await AuditLog.findOne({ action: 'GITHUB_WEBHOOK_INVALID_SIGNATURE' });
      expect(audit).not.toBeNull();
    });
  });

  describe('Delivery ID / Replay Protection & Race Condition Safety', () => {
    it('ignores duplicate delivery IDs and returns 200 without duplicate task mutation', async () => {
      const payloadObj = {
        action: 'closed',
        pull_request: {
          number: 10,
          title: `[TASK-${taskId}] Fix auth flow`,
          merged: true
        },
        repository: { id: 987654, full_name: 'testorg/testrepo' }
      };
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);
      const deliveryId = 'delivery-unique-100';

      // First Delivery
      const res1 = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', deliveryId)
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res1.status).toBe(200);
      expect(res1.body.message).toMatch(/Task auto-completed/);

      // Duplicate Delivery
      const res2 = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', deliveryId)
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toMatch(/already processed or in progress/);

      // Verify GitHubWebhookLog record created
      const logs = await GitHubWebhookLog.find({ deliveryId });
      expect(logs.length).toBe(1);
    });

    it('verifies TTL index configuration on GitHubWebhookLog', () => {
      const expiresOption = GitHubWebhookLog.schema.path('createdAt').options.expires;
      expect(expiresOption).toBe(604800); // 7 days in seconds
    });
  });

  describe('Repository & Event Validation', () => {
    it('safely ignores unsupported webhook events (e.g. ping, push)', async () => {
      const rawBody = JSON.stringify({ zen: 'Non-blocking is better than blocking.' });
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-ping-01')
        .set('x-github-event', 'ping')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/is not supported/);
    });

    it('ignores pull_request events where merged is false or action is not closed', async () => {
      const rawBody = JSON.stringify({
        action: 'opened',
        pull_request: { number: 1, title: 'Draft PR', merged: false },
        repository: { id: 987654, full_name: 'testorg/testrepo' }
      });
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-pr-opened-01')
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Pull request is not merged/);
    });

    it('ignores webhook requests for unmapped repositories and logs audit event', async () => {
      const rawBody = JSON.stringify({
        action: 'closed',
        pull_request: { number: 5, title: `[TASK-${taskId}]`, merged: true },
        repository: { id: 777777, full_name: 'unmapped/repo' }
      });
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-unmapped-01')
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Repository is not linked/);

      const audit = await AuditLog.findOne({ action: 'GITHUB_WEBHOOK_UNMAPPED_REPO' });
      expect(audit).not.toBeNull();
    });
  });

  describe('Deterministic Task Mapping & Controlled Completion', () => {
    it('extracts task reference IDs accurately from text helper', () => {
      const sampleText = 'Merged PR fixing [TASK-64f82d3aba1e5aac7854925e] and fixes #64f82d3aba1e5aac7854925f';
      const extracted = extractTaskIdsFromText(sampleText);
      expect(extracted.length).toBe(2);
      expect(extracted).toContain('64f82d3aba1e5aac7854925e');
      expect(extracted).toContain('64f82d3aba1e5aac7854925f');
    });

    it('auto-completes task on PR merge when valid task reference tag is present', async () => {
      const rawBody = JSON.stringify({
        action: 'closed',
        pull_request: {
          number: 88,
          title: `fixes #${taskId}`,
          html_url: 'https://github.com/testorg/testrepo/pull/88',
          merged: true
        },
        repository: { id: 987654, full_name: 'testorg/testrepo' }
      });
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-auto-close-88')
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Task auto-completed/);
      expect(res.body.taskId).toBe(taskId);

      // Verify Task updated to Done
      const updatedTask = await Task.findById(taskId);
      expect(updatedTask.status).toBe('Done');
      expect(updatedTask.completed).toBe(true);

      // Verify GitHubSyncMapping record created
      const syncMap = await GitHubSyncMapping.findOne({ taskId, referenceId: '88' });
      expect(syncMap).not.toBeNull();
      expect(syncMap.entityType).toBe('PR');

      // Verify AuditLog written
      const audit = await AuditLog.findOne({ action: 'GITHUB_PR_SYNCHRONIZED' });
      expect(audit).not.toBeNull();
    });

    it('rejects cross-project task completion attempts (IDOR protection)', async () => {
      // Create second project & task
      const proj2 = await Project.create({
        name: 'Second Project',
        ownerType: 'User',
        ownerId: userId
      });
      const taskInOtherProj = await Task.create({
        title: 'Task in Other Project',
        projectId: proj2._id,
        user: userId,
        status: 'READY'
      });

      // PR payload references task in proj2, but repository is linked to proj1
      const rawBody = JSON.stringify({
        action: 'closed',
        pull_request: {
          number: 99,
          title: `fixes #${taskInOtherProj._id.toString()}`,
          merged: true
        },
        repository: { id: 987654, full_name: 'testorg/testrepo' } // linked to proj1
      });
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-cross-proj-99')
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Referenced task not found in linked project/);

      // Verify task in proj2 was NOT modified
      const unmutatedTask = await Task.findById(taskInOtherProj._id);
      expect(unmutatedTask.status).toBe('READY');
      expect(unmutatedTask.completed).toBe(false);
    });

    it('handles PR merge on an already completed task idempotently without duplicate side effects', async () => {
      // Set task to Done prior to webhook
      await Task.updateOne({ _id: taskId }, { status: 'Done', completed: true, completedAt: new Date() });

      const rawBody = JSON.stringify({
        action: 'closed',
        pull_request: {
          number: 101,
          title: `[TASK-${taskId}] Already completed task PR`,
          html_url: 'https://github.com/testorg/testrepo/pull/101',
          merged: true
        },
        repository: { id: 987654, full_name: 'testorg/testrepo' }
      });
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-delivery', 'delivery-already-done-101')
        .set('x-github-event', 'pull_request')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Task is already completed');
      expect(res.body.taskId).toBe(taskId);

      // Verify task remains Done
      const finishedTask = await Task.findById(taskId);
      expect(finishedTask.status).toBe('Done');
      expect(finishedTask.completed).toBe(true);

      // Verify no duplicate audit log for completion action
      const auditCount = await AuditLog.countDocuments({ action: 'GITHUB_PR_SYNCHRONIZED' });
      expect(auditCount).toBe(0);
    });

    it('handles distinct delivery ID for same PR event on completed task safely', async () => {
      // First webhook completes task
      const rawBody1 = JSON.stringify({
        action: 'closed',
        pull_request: {
          number: 102,
          title: `fixes #${taskId}`,
          html_url: 'https://github.com/testorg/testrepo/pull/102',
          merged: true
        },
        repository: { id: 987654, full_name: 'testorg/testrepo' }
      });
      const sig1 = signPayload(rawBody1);

      const res1 = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig1)
        .set('x-github-delivery', 'delivery-first-102')
        .set('x-github-event', 'pull_request')
        .send(rawBody1);

      expect(res1.status).toBe(200);
      expect(res1.body.message).toMatch(/Task auto-completed/);

      // Second webhook has a DISTINCT delivery ID but same payload
      const sig2 = signPayload(rawBody1);
      const res2 = await request(app)
        .post('/api/github/webhooks')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig2)
        .set('x-github-delivery', 'delivery-distinct-102')
        .set('x-github-event', 'pull_request')
        .send(rawBody1);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toBe('Task is already completed');

      // Verify only 1 audit log was created (no duplicate side effects)
      const auditCount = await AuditLog.countDocuments({ action: 'GITHUB_PR_SYNCHRONIZED' });
      expect(auditCount).toBe(1);
    });
  });
});
