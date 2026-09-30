const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { sendPushToUser } = require('./webPushService');

// Map notification type to NotificationPreference schema field
const TYPE_TO_PREF_KEY = {
  'TASK_REMINDER': 'taskReminders',
  'TASK_ASSIGNMENT': 'taskAssignment',
  'TASK_COMPLETION': 'taskCompletion',
  'PROJECT_ACTIVITY': 'projectActivity',
  'MILESTONE_ACTIVITY': 'projectActivity',
  'TEAM_ACTIVITY': 'teamActivity',
  'FRIEND_ACTIVITY': 'friendActivity',
  'CHAT_MESSAGE': 'chatMessages',
  'SYSTEM_SECURITY': 'systemSecurity'
};

/**
 * Centralized Notification Dispatcher.
 * Handles preference checking, deduplication, persistence, Socket.IO in-app delivery, and Web Push delivery.
 */
async function sendNotification({
  recipient,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  projectId = null,
  taskId = null,
  conversationId = null,
  actor = null,
  deduplicationKey = null,
  metadata = {},
  io = null
}) {
  if (!recipient || !type || !title || !message) {
    throw new Error('Recipient, type, title, and message are required for notification');
  }

  // 1. Fetch User Preferences
  const prefs = await NotificationPreference.getOrCreateForUser(recipient);
  const prefCategoryKey = TYPE_TO_PREF_KEY[type] || 'systemSecurity';
  const categoryPrefs = prefs[prefCategoryKey] || { inApp: true, push: true };

  const isSystemSecurity = (type === 'SYSTEM_SECURITY');
  const allowInApp = isSystemSecurity ? true : Boolean(categoryPrefs.inApp);
  const allowPush = Boolean(categoryPrefs.push);

  if (!allowInApp && !allowPush) {
    return null; // Recipient disabled both channels for this notification category
  }

  // 2. Deduplication check
  if (deduplicationKey) {
    const existing = await Notification.findOne({ recipient, deduplicationKey });
    if (existing) {
      return existing; // Duplicate event safely ignored
    }
  }

  let notification = null;

  // 3. Persist Notification Document if in-app delivery is enabled
  if (allowInApp) {
    try {
      notification = new Notification({
        recipient,
        type,
        title,
        message,
        entityType,
        entityId,
        projectId,
        taskId,
        conversationId,
        actor,
        read: false,
        deliveryStatus: 'PENDING',
        deduplicationKey: deduplicationKey || undefined,
        metadata
      });
      await notification.save();
    } catch (err) {
      if (err.code === 11000 && deduplicationKey) {
        // Handle race condition on duplicate deduplicationKey
        return await Notification.findOne({ recipient, deduplicationKey });
      }
      console.error('Error persisting notification:', err);
    }
  }

  // 4. In-App Real-Time Socket.IO Delivery
  if (allowInApp && io && notification) {
    try {
      io.to(`user:${recipient.toString()}`).emit('notification', notification);
      notification.deliveryStatus = 'DELIVERED';
      await notification.save();
    } catch (socketErr) {
      console.error('Socket notification delivery error:', socketErr);
    }
  }

  // 5. Web Push Delivery
  if (allowPush) {
    const pushPayload = {
      title,
      body: message,
      icon: '/vite.svg',
      data: {
        notificationId: notification ? notification._id : null,
        type,
        entityType,
        entityId,
        url: taskId ? `/tasks/${taskId}` : projectId ? `/projects/${projectId}` : '/'
      }
    };

    // Deliver push asynchronously to avoid blocking API response
    sendPushToUser(recipient, pushPayload).catch(pushErr => {
      console.error('Web Push delivery error:', pushErr);
    });
  }

  return notification;
}

module.exports = {
  sendNotification,
  TYPE_TO_PREF_KEY
};
