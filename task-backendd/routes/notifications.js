const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const PushSubscription = require('../models/PushSubscription');
const { getVapidPublicKey } = require('../services/webPushService');

// Rate limiter for high-frequency notification push registration
const pushRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many push subscription requests, please try again later." }
});

// GET /api/notifications - List user's notifications with pagination
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const query = { recipient: req.user.id };
    if (req.query.unreadOnly === 'true') {
      query.read = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'username')
        .populate('projectId', 'name')
        .populate('taskId', 'title'),
      Notification.countDocuments(query)
    ]);

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread count for user
router.get('/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });
    res.json({ unreadCount });
  } catch (err) {
    console.error('Error fetching unread notification count:', err);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read for logged-in user
router.put('/read-all', async (req, res) => {
  try {
    const now = new Date();
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true, readAt: now } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// PUT /api/notifications/:id/read - Mark single notification as read (with strict user IDOR check)
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Strict IDOR check: user can only mark their own notification as read
    if (!notification.recipient.equals(req.user.id)) {
      return res.status(403).json({ error: 'Access denied for this notification' });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json(notification);
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// GET /api/notifications/preferences - Get notification preferences for user
router.get('/preferences', async (req, res) => {
  try {
    const prefs = await NotificationPreference.getOrCreateForUser(req.user.id);
    res.json(prefs);
  } catch (err) {
    console.error('Error fetching notification preferences:', err);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// PUT /api/notifications/preferences - Update notification preferences for user
router.put('/preferences', async (req, res) => {
  try {
    const prefs = await NotificationPreference.getOrCreateForUser(req.user.id);
    const updates = req.body;

    const allowedCategories = [
      'taskReminders',
      'taskAssignment',
      'taskCompletion',
      'projectActivity',
      'teamActivity',
      'friendActivity',
      'chatMessages',
      'systemSecurity'
    ];

    allowedCategories.forEach(category => {
      if (updates[category] && typeof updates[category] === 'object') {
        if (category === 'systemSecurity') {
          // Security policy: inApp security notifications cannot be disabled
          prefs.systemSecurity = {
            inApp: true,
            push: updates.systemSecurity.push !== undefined ? Boolean(updates.systemSecurity.push) : prefs.systemSecurity.push
          };
        } else {
          prefs[category] = {
            inApp: updates[category].inApp !== undefined ? Boolean(updates[category].inApp) : prefs[category].inApp,
            push: updates[category].push !== undefined ? Boolean(updates[category].push) : prefs[category].push
          };
        }
      }
    });

    await prefs.save();
    res.json(prefs);
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// GET /api/notifications/push/vapid-key - Get VAPID public key
router.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// POST /api/notifications/push/subscribe - Register or update Web Push subscription
router.post('/push/subscribe', pushRateLimiter, async (req, res) => {
  try {
    const { endpoint, keys, deviceLabel, userAgent } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Endpoint and keys (p256dh, auth) are required' });
    }

    let sub = await PushSubscription.findOne({ endpoint });
    if (sub) {
      sub.user = req.user.id;
      sub.keys = keys;
      sub.deviceLabel = deviceLabel || sub.deviceLabel;
      sub.userAgent = userAgent || sub.userAgent;
      sub.lastUsedAt = new Date();
    } else {
      sub = new PushSubscription({
        user: req.user.id,
        endpoint,
        keys,
        deviceLabel: deviceLabel || 'Web Browser',
        userAgent: userAgent || ''
      });
    }

    await sub.save();
    res.status(201).json(sub);
  } catch (err) {
    console.error('Error registering push subscription:', err);
    res.status(500).json({ error: 'Failed to register push subscription' });
  }
});

// POST /api/notifications/push/unsubscribe - Remove Web Push subscription
router.post('/push/unsubscribe', pushRateLimiter, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    const sub = await PushSubscription.findOne({ endpoint, user: req.user.id });
    if (sub) {
      await PushSubscription.deleteOne({ _id: sub._id });
    }

    res.json({ message: 'Push subscription removed successfully' });
  } catch (err) {
    console.error('Error removing push subscription:', err);
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
});

module.exports = router;
