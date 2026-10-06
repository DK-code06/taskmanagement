const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const GitHubWebhookLog = require('../models/GitHubWebhookLog');
const GitHubRepositoryLink = require('../models/GitHubRepositoryLink');
const GitHubSyncMapping = require('../models/GitHubSyncMapping');
const Task = require('../models/Task');
const { logAuditEvent } = require('../services/auditService');
const { logActivityEvent } = require('../services/activityService');
const { sendNotification } = require('../services/notificationService');

const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many webhook requests from this IP' }
});

/**
 * Validates GitHub HMAC SHA-256 signature (`x-hub-signature-256`).
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) return false;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expectedHex = 'sha256=' + hmac.digest('hex');

    const providedBuf = Buffer.from(signatureHeader);
    const expectedBuf = Buffer.from(calculatedHex);

    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Helper to parse deterministic Task ObjectIds from PR title, body, or head branch reference.
 * Supported patterns: `[TASK-<24hex>]`, `fixes #<24hex>`, `closes #<24hex>`, `resolves #<24hex>`
 */
function extractTaskIdsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const taskIds = new Set();

  // Pattern 1: [TASK-64f82d3aba1e5aac7854925e]
  const pattern1 = /\[TASK-([0-9a-fA-F]{24})\]/gi;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    taskIds.add(match[1]);
  }

  // Pattern 2: fixes #64f82d3aba1e5aac7854925e, closes #64f82d3aba1e5aac7854925e, resolves #64f82d3aba1e5aac7854925e
  const pattern2 = /(?:fixes|closes|resolves)\s+#?([0-9a-fA-F]{24})/gi;
  while ((match = pattern2.exec(text)) !== null) {
    taskIds.add(match[1]);
  }

  return Array.from(taskIds);
}

function createGitHubWebhookRoutes(io) {
  const router = express.Router();

  /**
   * POST /api/github/webhooks
   * Signature-verified, idempotency-protected GitHub Webhook Endpoint.
   */
  router.post('/', webhookRateLimiter, async (req, res) => {
    try {
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return res.status(500).json({ error: 'GITHUB_WEBHOOK_SECRET is not configured on server' });
      }

      // Extract raw body buffer for HMAC verification
      let rawBody = req.body;
      if (typeof rawBody === 'string') {
        rawBody = Buffer.from(rawBody, 'utf8');
      } else if (!Buffer.isBuffer(rawBody)) {
        if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
          rawBody = req.rawBody;
        } else {
          rawBody = Buffer.from(JSON.stringify(req.body || {}), 'utf8');
        }
      }

      const signatureHeader = req.headers['x-hub-signature-256'];
      if (!signatureHeader) {
        await logAuditEvent({ action: 'GITHUB_WEBHOOK_INVALID_SIGNATURE', req, details: { reason: 'Missing x-hub-signature-256 header' } });
        return res.status(400).json({ error: 'Missing x-hub-signature-256 header' });
      }

      // Verify HMAC-SHA256 signature using constant-time comparison
      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = 'sha256=' + hmac.digest('hex');

      try {
        const provBuf = Buffer.from(signatureHeader);
        const expBuf = Buffer.from(expectedSignature);
        if (provBuf.length !== expBuf.length || !crypto.timingSafeEqual(provBuf, expBuf)) {
          await logAuditEvent({ action: 'GITHUB_WEBHOOK_INVALID_SIGNATURE', req, details: { reason: 'Signature mismatch' } });
          return res.status(401).json({ error: 'Invalid HMAC SHA-256 webhook signature' });
        }
      } catch (sigErr) {
        await logAuditEvent({ action: 'GITHUB_WEBHOOK_INVALID_SIGNATURE', req, details: { reason: sigErr.message } });
        return res.status(401).json({ error: 'Invalid HMAC SHA-256 webhook signature format' });
      }

      // Delivery ID Replay Protection & Atomic Idempotency Check
      const deliveryId = req.headers['x-github-delivery'];
      const eventType = req.headers['x-github-event'] || 'unknown';

      if (!deliveryId) {
        return res.status(400).json({ error: 'Missing x-github-delivery header' });
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (parseErr) {
        return res.status(400).json({ error: 'Invalid JSON webhook payload' });
      }

      const repoFullName = payload?.repository?.full_name || '';

      // Atomic log creation prevents race conditions on duplicate delivery IDs
      let webhookLog;
      try {
        webhookLog = await GitHubWebhookLog.create({
          deliveryId,
          eventType,
          repositoryFullName: repoFullName,
          processedStatus: 'PROCESSING'
        });
      } catch (dbErr) {
        if (dbErr.code === 11000 || dbErr.message?.includes('duplicate key')) {
          return res.status(200).json({ message: 'Webhook delivery already processed or in progress', deliveryId });
        }
        throw dbErr;
      }

      // Event Validation: For Milestone 3, process pull_request closed & merged events
      if (eventType !== 'pull_request') {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'IGNORED', details: { reason: `Unsupported event type: ${eventType}` } }
        );
        return res.status(200).json({ message: `Event ignored: ${eventType} is not supported` });
      }

      const action = payload.action;
      const isMerged = Boolean(payload.pull_request?.merged);

      if (action !== 'closed' || !isMerged) {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'IGNORED', details: { reason: 'PR not closed or not merged' } }
        );
        return res.status(200).json({ message: 'Event ignored: Pull request is not merged' });
      }

      // Repository Mapping Verification
      const githubRepoId = payload.repository?.id?.toString();
      if (!githubRepoId) {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'FAILED', details: { reason: 'Missing repository ID' } }
        );
        return res.status(400).json({ error: 'Missing repository identifier in webhook payload' });
      }

      const repoLink = await GitHubRepositoryLink.findOne({ githubRepoId });
      if (!repoLink) {
        await logAuditEvent({ action: 'GITHUB_WEBHOOK_UNMAPPED_REPO', req, details: { githubRepoId, repoFullName } });
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'IGNORED', details: { reason: 'Unmapped repository' } }
        );
        return res.status(200).json({ message: 'Repository is not linked to any Task App project' });
      }

      if (!repoLink.autoCloseOnPRMerge) {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'IGNORED', details: { reason: 'autoCloseOnPRMerge is disabled' } }
        );
        return res.status(200).json({ message: 'Auto-close on PR merge is disabled for this project' });
      }

      // Deterministic Task Mapping Verification
      const prTitle = payload.pull_request?.title || '';
      const prBody = payload.pull_request?.body || '';
      const headRef = payload.pull_request?.head?.ref || '';
      const combinedText = `${prTitle} ${prBody} ${headRef}`;

      const candidateTaskIds = extractTaskIdsFromText(combinedText);

      // Also check explicit pre-existing sync mapping
      const existingMapping = await GitHubSyncMapping.findOne({
        githubRepoId,
        referenceId: payload.pull_request.number.toString(),
        entityType: 'PR'
      });

      if (existingMapping && !candidateTaskIds.includes(existingMapping.taskId.toString())) {
        candidateTaskIds.push(existingMapping.taskId.toString());
      }

      if (candidateTaskIds.length === 0) {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'IGNORED', details: { reason: 'No deterministic task reference tags found in PR' } }
        );
        return res.status(200).json({ message: 'No matching task reference tag found in PR' });
      }

      // Find valid task within the mapped project
      let targetTask = null;
      for (const taskIdStr of candidateTaskIds) {
        if (mongoose.Types.ObjectId.isValid(taskIdStr)) {
          const found = await Task.findOne({
            _id: taskIdStr,
            projectId: repoLink.projectId,
            deletedAt: null
          });
          if (found) {
            targetTask = found;
            break;
          }
        }
      }

      if (!targetTask) {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'IGNORED', details: { reason: 'Referenced task not found in mapped project' } }
        );
        return res.status(200).json({ message: 'Referenced task not found in linked project' });
      }

      // Idempotent Task Mutation (If task already completed, avoid side effects)
      if (targetTask.status === 'Done' || targetTask.status === 'COMPLETED' || targetTask.completed) {
        await GitHubWebhookLog.updateOne(
          { _id: webhookLog._id },
          { processedStatus: 'SUCCESS', details: { taskId: targetTask._id, skipped: 'Task already completed' } }
        );
        return res.status(200).json({ message: 'Task is already completed', taskId: targetTask._id });
      }

      // Mutate Task Status to 'Done'
      targetTask.status = 'Done';
      targetTask.completed = true;
      targetTask.completedAt = new Date();
      await targetTask.save();

      // Upsert GitHubSyncMapping record
      await GitHubSyncMapping.findOneAndUpdate(
        {
          taskId: targetTask._id,
          githubRepoId,
          entityType: 'PR',
          referenceId: payload.pull_request.number.toString()
        },
        {
          projectId: repoLink.projectId,
          title: prTitle,
          url: payload.pull_request.html_url || '',
          status: 'MERGED'
        },
        { upsert: true, new: true }
      );

      // Reward Policy & Actor Identification (Assignee receives completion attribution, NOT webhook caller)
      const actorId = targetTask.assignedTo || targetTask.user || repoLink.linkedBy;

      // Log Activity Event
      await logActivityEvent({
        eventType: 'TASK_COMPLETED',
        actorId: actorId,
        projectId: targetTask.projectId,
        taskId: targetTask._id,
        metadata: {
          source: 'GITHUB_PR_MERGE',
          prNumber: payload.pull_request.number,
          prTitle: prTitle
        }
      });

      // Dispatch Centralized Notification
      if (actorId) {
        await sendNotification({
          recipient: actorId,
          type: 'TASK_COMPLETION',
          title: `Task auto-completed via PR #${payload.pull_request.number}`,
          message: `Task "${targetTask.title}" was completed by merged PR #${payload.pull_request.number}`,
          entityType: 'Task',
          entityId: targetTask._id,
          actor: actorId,
          deduplicationKey: `github_pr_completed:${targetTask._id.toString()}:${payload.pull_request.number}`,
          io
        }).catch(err => console.error('❌ Notification error on PR sync:', err));
      }

      // Socket.IO Real-Time Update
      if (io) {
        io.to(`project:${targetTask.projectId.toString()}`).emit('taskUpdated', targetTask);
      }

      // Audit Log
      await logAuditEvent({
        userId: actorId,
        action: 'GITHUB_PR_SYNCHRONIZED',
        req,
        details: {
          taskId: targetTask._id,
          projectId: targetTask.projectId,
          githubRepoId,
          prNumber: payload.pull_request.number
        }
      });

      // Update Webhook Log
      await GitHubWebhookLog.updateOne(
        { _id: webhookLog._id },
        { processedStatus: 'SUCCESS', details: { taskId: targetTask._id, prNumber: payload.pull_request.number } }
      );

      res.status(200).json({
        message: 'Task auto-completed from GitHub PR merge',
        taskId: targetTask._id,
        prNumber: payload.pull_request.number
      });
    } catch (err) {
      console.error('❌ Error processing GitHub webhook:', err);
      await logAuditEvent({ action: 'GITHUB_SYNC_FAILED', req, details: { error: err.message } });
      res.status(500).json({ error: 'Internal server error while processing webhook' });
    }
  });

  return router;
}

module.exports = function createGitHubWebhookRoutesWrapper(io) {
  return createGitHubWebhookRoutes(io);
};
module.exports.createGitHubWebhookRoutes = createGitHubWebhookRoutes;
module.exports.verifyWebhookSignature = verifyWebhookSignature;
module.exports.extractTaskIdsFromText = extractTaskIdsFromText;
