const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const GitHubConnection = require('../models/GitHubConnection');
const GitHubRepositoryLink = require('../models/GitHubRepositoryLink');
const GitHubSyncMapping = require('../models/GitHubSyncMapping');
const { encryptToken, decryptToken } = require('../services/encryptionService');
const { getUserRepositories, verifyAndFetchRepository } = require('../services/githubService');
const { logAuditEvent } = require('../services/auditService');
const { authorizeProject } = require('../middleware/authorize');

/**
 * Helper to safely extract user ID from req.user (supports id or _id).
 */
function getUserId(user) {
  if (!user) return null;
  return user.id || user._id;
}

/**
 * Generates an HMAC-SHA256 signed OAuth state parameter.
 * Format: `userId:timestamp:nonce:signature`
 */
function generateOAuthState(userId) {
  const secret = process.env.GITHUB_CLIENT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Server secret configuration missing for OAuth state signing.');
  }
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${userId}:${timestamp}:${nonce}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

/**
 * Validates an HMAC-SHA256 signed OAuth state parameter.
 * Enforces 10-minute expiration window and user identity match.
 */
function verifyOAuthState(stateString, userId) {
  if (!stateString || typeof stateString !== 'string' || !userId) return false;

  const secret = process.env.GITHUB_CLIENT_SECRET || process.env.JWT_SECRET;
  if (!secret) return false;

  const parts = stateString.split(':');
  if (parts.length !== 4) return false;

  const [stateUserId, timestampStr, nonce, providedSignature] = parts;

  // Verify user ID matches authenticated session user
  if (stateUserId !== userId.toString()) return false;

  // Verify timestamp within 10-minute validity window (600,000 ms)
  const timestamp = parseInt(timestampStr, 10);
  const now = Date.now();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  if (isNaN(timestamp) || now - timestamp > TEN_MINUTES_MS || timestamp > now + 60000) {
    return false;
  }

  // Recalculate HMAC signature
  const payload = `${stateUserId}:${timestampStr}:${nonce}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Constant-time signature comparison to prevent timing attacks
  try {
    const provBuffer = Buffer.from(providedSignature, 'hex');
    const expBuffer = Buffer.from(expectedSignature, 'hex');
    if (provBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(provBuffer, expBuffer);
  } catch (err) {
    return false;
  }
}

function createGitHubRoutes(io) {
  const router = express.Router();

  /**
   * GET /api/github/connect
   * Initiates GitHub OAuth authorization flow.
   */
  router.get('/connect', async (req, res) => {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'GitHub OAuth is not configured on this server. GITHUB_CLIENT_ID is missing.' });
      }

      const currentUserId = getUserId(req.user);
      const scope = req.query.scope || 'repo';
      const state = generateOAuthState(currentUserId);
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

      if (req.query.redirect === 'true') {
        return res.redirect(authUrl);
      }

      res.json({ url: authUrl, state });
    } catch (err) {
      console.error('❌ Error initiating GitHub connection:', err);
      res.status(500).json({ error: 'Internal server error while initiating GitHub connection' });
    }
  });

  /**
   * GET /api/github/callback
   * Handles GitHub OAuth authorization code exchange and completes account connection.
   */
  router.get('/callback', async (req, res) => {
    try {
      const { code, state, error: oauthError } = req.query;
      const currentUserId = getUserId(req.user);

      if (oauthError || !code || !state) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_CONNECTION_FAILED',
          req,
          details: { reason: oauthError || 'Missing code or state parameter' }
        });
        return res.status(400).json({ error: oauthError ? `GitHub authorization error: ${oauthError}` : 'Missing authorization code or state parameter' });
      }

      // Validate CSRF state token
      const isStateValid = verifyOAuthState(state, currentUserId);
      if (!isStateValid) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_CONNECTION_FAILED',
          req,
          details: { reason: 'Invalid or expired OAuth state parameter' }
        });
        return res.status(400).json({ error: 'Invalid or expired OAuth state parameter. Request rejected for security.' });
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'GitHub OAuth client credentials missing on server' });
      }

      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code
        })
      });

      if (!tokenRes.ok) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_CONNECTION_FAILED',
          req,
          details: { reason: 'GitHub token exchange endpoint returned non-200' }
        });
        return res.status(400).json({ error: 'Failed to exchange authorization code with GitHub' });
      }

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_CONNECTION_FAILED',
          req,
          details: { reason: tokenData.error_description || 'No access token returned from GitHub' }
        });
        return res.status(400).json({ error: tokenData.error_description || 'GitHub OAuth token request failed' });
      }

      // Fetch user profile from GitHub API using exchanged token
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'User-Agent': 'Task-Management-App'
        }
      });

      if (!userRes.ok) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_CONNECTION_FAILED',
          req,
          details: { reason: 'GitHub user profile request failed' }
        });
        return res.status(400).json({ error: 'Failed to fetch GitHub user profile' });
      }

      const githubUser = await userRes.json();
      if (!githubUser.id || !githubUser.login) {
        return res.status(400).json({ error: 'Invalid GitHub user profile data returned' });
      }

      const githubUserIdStr = githubUser.id.toString();

      // Prevent GitHub account hijacking: Check if account linked to another user
      const existingAccount = await GitHubConnection.findOne({
        githubUserId: githubUserIdStr,
        userId: { $ne: currentUserId }
      });

      if (existingAccount) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_CONNECTION_FAILED',
          req,
          details: { reason: 'GitHub account already connected to another user', githubUserId: githubUserIdStr }
        });
        return res.status(409).json({ error: 'This GitHub account is already connected to a different user account.' });
      }

      // Encrypt access token before storing
      const encryptedToken = encryptToken(tokenData.access_token);

      const connection = await GitHubConnection.findOneAndUpdate(
        { userId: currentUserId },
        {
          githubUserId: githubUserIdStr,
          githubUsername: githubUser.login,
          encryptedAccessToken: encryptedToken,
          scope: tokenData.scope || 'repo',
          connectedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await logAuditEvent({
        userId: currentUserId,
        action: 'GITHUB_CONNECTED',
        req,
        details: { githubUsername: githubUser.login, githubUserId: githubUserIdStr }
      });

      if (io && currentUserId) {
        io.to(`user:${currentUserId.toString()}`).emit('githubConnected', {
          githubUsername: connection.githubUsername,
          connectedAt: connection.connectedAt
        });
      }

      res.json({
        message: 'GitHub account connected successfully',
        connection: {
          githubUsername: connection.githubUsername,
          scope: connection.scope,
          connectedAt: connection.connectedAt
        }
      });
    } catch (err) {
      console.error('❌ Error processing GitHub OAuth callback:', err);
      const currentUserId = getUserId(req.user);
      await logAuditEvent({
        userId: currentUserId,
        action: 'GITHUB_CONNECTION_FAILED',
        req,
        details: { reason: err.message }
      });
      res.status(500).json({ error: 'Internal server error while completing GitHub authorization' });
    }
  });

  /**
   * GET /api/github/status
   * Checks whether the authenticated user has a connected GitHub account.
   */
  router.get('/status', async (req, res) => {
    try {
      const currentUserId = getUserId(req.user);
      const connection = await GitHubConnection.findOne({ userId: currentUserId });
      if (!connection) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        githubUsername: connection.githubUsername,
        scope: connection.scope,
        connectedAt: connection.connectedAt
      });
    } catch (err) {
      console.error('❌ Error fetching GitHub connection status:', err);
      res.status(500).json({ error: 'Internal server error while fetching GitHub connection status' });
    }
  });

  /**
   * POST /api/github/disconnect
   * Hard-deletes GitHub connection record and attempts token revocation.
   */
  router.post('/disconnect', async (req, res) => {
    try {
      const currentUserId = getUserId(req.user);
      const connection = await GitHubConnection.findOne({ userId: currentUserId });
      if (!connection) {
        return res.status(404).json({ error: 'No connected GitHub account found' });
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      // Revoke token at GitHub (best-effort)
      if (clientId && clientSecret && connection.encryptedAccessToken) {
        try {
          const accessToken = decryptToken(connection.encryptedAccessToken);
          const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          await fetch(`https://api.github.com/applications/${clientId}/grant`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json',
              'User-Agent': 'Task-Management-App'
            },
            body: JSON.stringify({ access_token: accessToken })
          });
        } catch (revokeErr) {
          console.warn('⚠️ GitHub token revocation notice:', revokeErr.message);
        }
      }

      await GitHubConnection.deleteOne({ userId: currentUserId });

      await logAuditEvent({
        userId: currentUserId,
        action: 'GITHUB_DISCONNECTED',
        req,
        details: { githubUsername: connection.githubUsername }
      });

      if (io && currentUserId) {
        io.to(`user:${currentUserId.toString()}`).emit('githubDisconnected');
      }

      res.json({ message: 'GitHub account disconnected successfully' });
    } catch (err) {
      console.error('❌ Error disconnecting GitHub account:', err);
      res.status(500).json({ error: 'Internal server error while disconnecting GitHub account' });
    }
  });

  /**
   * GET /api/github/repositories
   * Retrieves repositories accessible to the authenticated GitHub user.
   */
  router.get('/repositories', async (req, res) => {
    try {
      const currentUserId = getUserId(req.user);
      const connection = await GitHubConnection.findOne({ userId: currentUserId });
      if (!connection) {
        return res.status(404).json({ error: 'No connected GitHub account found' });
      }

      const repositories = await getUserRepositories(connection.encryptedAccessToken, {
        page: parseInt(req.query.page, 10) || 1,
        per_page: parseInt(req.query.per_page, 10) || 100
      });

      res.json({ repositories });
    } catch (err) {
      console.error('❌ Error fetching GitHub repositories:', err.message);
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      res.status(500).json({ error: 'Internal server error while retrieving GitHub repositories' });
    }
  });

  return router;
}

/**
 * Creates Project-level GitHub Repository linking routes.
 * Mounted at `/api/projects` in server.js.
 */
function createGitHubProjectRoutes(io) {
  const router = express.Router({ mergeParams: true });

  /**
   * GET /api/projects/:projectId/github/repositories
   * Lists GitHub repositories linked to a project. Requires Project MEMBER access.
   */
  router.get('/:projectId/github/repositories', authorizeProject('MEMBER'), async (req, res) => {
    try {
      const projectId = req.project._id;
      const repoLinks = await GitHubRepositoryLink.find({ projectId }).sort({ createdAt: -1 });

      res.json({ repositories: repoLinks });
    } catch (err) {
      console.error('❌ Error listing project GitHub repositories:', err);
      res.status(500).json({ error: 'Internal server error while fetching linked repositories' });
    }
  });

  /**
   * GET /api/projects/:projectId/github/tasks/:taskId
   * Retrieves GitHub sync mappings and repository links for a specific task.
   * Requires Project MEMBER access.
   */
  router.get('/:projectId/github/tasks/:taskId', authorizeProject('MEMBER'), async (req, res) => {
    try {
      const projectId = req.project._id;
      const { taskId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({ error: 'Invalid task ID format' });
      }

      const syncMappings = await GitHubSyncMapping.find({ projectId, taskId }).sort({ createdAt: -1 });
      const repositories = await GitHubRepositoryLink.find({ projectId }).sort({ createdAt: -1 });

      res.json({
        taskId,
        projectId,
        syncMappings,
        pullRequests: syncMappings.filter(m => m.entityType === 'PR'),
        repositories
      });
    } catch (err) {
      console.error('❌ Error fetching task GitHub details:', err);
      res.status(500).json({ error: 'Internal server error while fetching task GitHub details' });
    }
  });

  // Alias GET route
  router.get('/:projectId/github/link', authorizeProject('MEMBER'), async (req, res) => {
    try {
      const projectId = req.project._id;
      const repoLinks = await GitHubRepositoryLink.find({ projectId }).sort({ createdAt: -1 });
      res.json({ repositories: repoLinks });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error while fetching linked repositories' });
    }
  });

  /**
   * POST /api/projects/:projectId/github/repositories
   * Links a GitHub repository to a project. Requires Project ADMIN role & server-side GitHub access check.
   */
  router.post('/:projectId/github/repositories', authorizeProject('ADMIN'), async (req, res) => {
    try {
      const currentUserId = getUserId(req.user);
      const projectId = req.project._id;

      let { owner, name, fullName, githubRepoId, autoCloseOnPRMerge } = req.body;

      if (!owner || !name) {
        if (fullName && fullName.includes('/')) {
          const parts = fullName.split('/');
          owner = parts[0];
          name = parts[1];
        } else {
          await logAuditEvent({
            userId: currentUserId,
            action: 'GITHUB_REPO_LINK_FAILED',
            req,
            details: { projectId, reason: 'Missing repository owner or name' }
          });
          return res.status(400).json({ error: 'Repository owner and name (or fullName) are required' });
        }
      }

      // Check if user has connected GitHub account
      const connection = await GitHubConnection.findOne({ userId: currentUserId });
      if (!connection) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_REPO_LINK_FAILED',
          req,
          details: { projectId, reason: 'No connected GitHub account' }
        });
        return res.status(400).json({ error: 'Connected GitHub account required to link repositories' });
      }

      // Server-side GitHub repository access verification (DO NOT trust frontend claims)
      let repoMeta;
      try {
        repoMeta = await verifyAndFetchRepository(connection.encryptedAccessToken, owner, name);
      } catch (verifyErr) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_REPO_LINK_FAILED',
          req,
          details: { projectId, owner, name, reason: verifyErr.message }
        });
        const status = verifyErr.status || 403;
        return res.status(status).json({ error: verifyErr.message || 'GitHub repository access verification failed' });
      }

      // If githubRepoId supplied, verify it matches canonical GitHub ID
      if (githubRepoId && githubRepoId.toString() !== repoMeta.githubRepoId) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_REPO_LINK_FAILED',
          req,
          details: { projectId, owner, name, reason: 'Repository ID mismatch' }
        });
        return res.status(400).json({ error: 'Provided repository ID does not match canonical GitHub repository' });
      }

      // Check duplicate repository link for this project
      const existingLink = await GitHubRepositoryLink.findOne({
        projectId: projectId,
        githubRepoId: repoMeta.githubRepoId
      });

      if (existingLink) {
        await logAuditEvent({
          userId: currentUserId,
          action: 'GITHUB_REPO_LINK_FAILED',
          req,
          details: { projectId, githubRepoId: repoMeta.githubRepoId, reason: 'Duplicate repository link' }
        });
        return res.status(409).json({ error: 'This GitHub repository is already linked to this project' });
      }

      const repoLink = await GitHubRepositoryLink.create({
        projectId: projectId,
        githubRepoId: repoMeta.githubRepoId,
        owner: repoMeta.owner,
        name: repoMeta.name,
        fullName: repoMeta.fullName,
        private: repoMeta.private,
        defaultBranch: repoMeta.defaultBranch,
        autoCloseOnPRMerge: autoCloseOnPRMerge !== undefined ? Boolean(autoCloseOnPRMerge) : true,
        linkedBy: currentUserId,
        linkedAt: new Date()
      });

      await logAuditEvent({
        userId: currentUserId,
        action: 'GITHUB_REPO_LINKED',
        req,
        details: { projectId, githubRepoId: repoMeta.githubRepoId, fullName: repoMeta.fullName }
      });

      if (io) {
        io.to(`project:${projectId.toString()}`).emit('githubRepoLinked', repoLink);
      }

      res.status(201).json({
        message: 'Repository linked successfully',
        link: repoLink
      });
    } catch (err) {
      console.error('❌ Error linking GitHub repository:', err);
      const currentUserId = getUserId(req.user);
      await logAuditEvent({
        userId: currentUserId,
        action: 'GITHUB_REPO_LINK_FAILED',
        req,
        details: { reason: err.message }
      });
      res.status(500).json({ error: 'Internal server error while linking GitHub repository' });
    }
  });

  // Alias POST route
  router.post('/:projectId/github/link', authorizeProject('ADMIN'), async (req, res, next) => {
    // Forward to the main handler logic above by rewriting url or invoking handler
    req.url = `/${req.params.projectId}/github/repositories`;
    router.handle(req, res, next);
  });

  /**
   * DELETE /api/projects/:projectId/github/repositories/:repositoryId
   * Unlinks a GitHub repository from a project. Requires Project ADMIN role.
   */
  router.delete('/:projectId/github/repositories/:repositoryId', authorizeProject('ADMIN'), async (req, res) => {
    try {
      const currentUserId = getUserId(req.user);
      const projectId = req.project._id;
      const repositoryIdParam = req.params.repositoryId;

      const filter = { projectId };
      if (mongoose.Types.ObjectId.isValid(repositoryIdParam)) {
        filter.$or = [{ _id: repositoryIdParam }, { githubRepoId: repositoryIdParam }];
      } else {
        filter.githubRepoId = repositoryIdParam;
      }

      const link = await GitHubRepositoryLink.findOne(filter);
      if (!link) {
        return res.status(404).json({ error: 'Repository link not found for this project' });
      }

      await GitHubRepositoryLink.deleteOne({ _id: link._id });

      await logAuditEvent({
        userId: currentUserId,
        action: 'GITHUB_REPO_UNLINKED',
        req,
        details: { projectId, githubRepoId: link.githubRepoId, fullName: link.fullName }
      });

      if (io) {
        io.to(`project:${projectId.toString()}`).emit('githubRepoUnlinked', {
          projectId,
          githubRepoId: link.githubRepoId
        });
      }

      res.json({
        message: 'Repository unlinked successfully',
        unlinkedRepoId: link.githubRepoId
      });
    } catch (err) {
      console.error('❌ Error unlinking GitHub repository:', err);
      res.status(500).json({ error: 'Internal server error while unlinking GitHub repository' });
    }
  });

  // Alias DELETE route
  router.delete('/:projectId/github/unlink/:repositoryId', authorizeProject('ADMIN'), async (req, res, next) => {
    req.url = `/${req.params.projectId}/github/repositories/${req.params.repositoryId}`;
    router.handle(req, res, next);
  });

  return router;
}

module.exports = function createGitHubRoutesWrapper(io) {
  return createGitHubRoutes(io);
};

module.exports.createGitHubRoutes = createGitHubRoutes;
module.exports.createGitHubProjectRoutes = createGitHubProjectRoutes;
module.exports.generateOAuthState = generateOAuthState;
module.exports.verifyOAuthState = verifyOAuthState;
