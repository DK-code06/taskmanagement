const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const ActivityEvent = require('../models/ActivityEvent');
const { canAccessTask } = require('../middleware/authorize');
const { isConfigured, decomposeTask, summarizeTask } = require('../services/geminiService');

// User-level rate limiter: max 10 requests per 15 minutes
const userAiRateLimits = new Map();

function checkUserAiRateLimit(userId) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 10;

  let record = userAiRateLimits.get(userId.toString());
  if (!record || (now - record.startTime) > windowMs) {
    record = { startTime: now, count: 0 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remainingWindowMs: windowMs - (now - record.startTime) };
  }

  record.count++;
  userAiRateLimits.set(userId.toString(), record);
  return { allowed: true };
}

// GET /api/ai/status - Check AI backend configuration, user consent, and availability
router.get('/status', async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('aiConsent');
    const userConsentEnabled = Boolean(userDoc && userDoc.aiConsent);
    const backendConfigured = isConfigured();
    const aiAvailable = backendConfigured && userConsentEnabled;

    let statusLabel = 'AVAILABLE';
    if (!userConsentEnabled) {
      statusLabel = 'CONSENT_REQUIRED';
    } else if (!backendConfigured) {
      statusLabel = 'KEY_NOT_CONFIGURED';
    }

    res.json({
      backendConfigured,
      userConsentEnabled,
      aiAvailable,
      statusLabel
    });
  } catch (err) {
    console.error('Failed to fetch AI status:', err);
    res.status(500).json({ error: 'Failed to fetch AI status' });
  }
});

// PUT /api/user/preferences/ai - Update user AI consent preference
router.put('/preferences/ai', async (req, res) => {
  try {
    const { aiConsent } = req.body;

    if (typeof aiConsent !== 'boolean') {
      return res.status(400).json({ error: 'aiConsent boolean parameter is required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { aiConsent },
      { new: true }
    ).select('aiConsent username');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      aiConsent: updatedUser.aiConsent,
      message: updatedUser.aiConsent
        ? 'AI feature consent enabled successfully.'
        : 'AI feature consent revoked.'
    });
  } catch (err) {
    console.error('Failed to update AI consent preference:', err);
    res.status(500).json({ error: 'Failed to update AI consent preference' });
  }
});

// POST /api/ai/tasks/:id/decompose - Suggest subtask decomposition for a task (Advisory Only)
router.post('/tasks/:id/decompose', async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    // Task Ownership / Access Authorization
    const accessCheck = await canAccessTask(req.user.id, taskId);
    if (!accessCheck.allowed) {
      if (accessCheck.reason === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(403).json({ error: 'Access denied for this task' });
    }

    // Consent Check
    const userDoc = await User.findById(req.user.id).select('aiConsent');
    if (!userDoc || !userDoc.aiConsent) {
      return res.status(403).json({
        error: 'AI feature consent required before processing tasks.',
        consentRequired: true
      });
    }

    // Rate Limit Check
    const rateLimitCheck = checkUserAiRateLimit(req.user.id);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'AI request limit exceeded (max 10 requests per 15 minutes). Please try again later.',
        retryAfterMs: rateLimitCheck.remainingWindowMs
      });
    }

    const task = accessCheck.task;
    const result = await decomposeTask(task);

    if (!result.available) {
      return res.status(503).json({
        available: false,
        fallback: true,
        reason: result.reason,
        suggestions: result.suggestions
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error during AI task decomposition:', err);
    res.status(500).json({ error: 'Failed to generate AI task decomposition' });
  }
});

// POST /api/ai/tasks/:id/summarize - Generate executive task summary (Advisory Only)
router.post('/tasks/:id/summarize', async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    // Task Ownership / Access Authorization
    const accessCheck = await canAccessTask(req.user.id, taskId);
    if (!accessCheck.allowed) {
      if (accessCheck.reason === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(403).json({ error: 'Access denied for this task' });
    }

    // Consent Check
    const userDoc = await User.findById(req.user.id).select('aiConsent');
    if (!userDoc || !userDoc.aiConsent) {
      return res.status(403).json({
        error: 'AI feature consent required before processing tasks.',
        consentRequired: true
      });
    }

    // Rate Limit Check
    const rateLimitCheck = checkUserAiRateLimit(req.user.id);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: 'AI request limit exceeded (max 10 requests per 15 minutes). Please try again later.',
        retryAfterMs: rateLimitCheck.remainingWindowMs
      });
    }

    const task = accessCheck.task;
    const activityEvents = await ActivityEvent.find({ taskId: task._id }).sort({ createdAt: -1 }).limit(10);

    const result = await summarizeTask(task, activityEvents);

    if (!result.available) {
      return res.status(503).json({
        available: false,
        fallback: true,
        reason: result.reason,
        summary: result.summary,
        keyTakeaways: result.keyTakeaways
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error during AI task summarization:', err);
    res.status(500).json({ error: 'Failed to generate AI task summary' });
  }
});

module.exports = router;
