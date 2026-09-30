const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
};

// Generate local fallback VAPID keypair if missing in test/development env
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys.publicKey = vapidKeys.publicKey || generated.publicKey;
    vapidKeys.privateKey = vapidKeys.privateKey || generated.privateKey;
    process.env.VAPID_PUBLIC_KEY = vapidKeys.publicKey;
  } catch (err) {
    console.error('Failed to generate fallback VAPID keys:', err);
  }
}

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      vapidKeys.subject,
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err) {
    console.error('Failed to set VAPID details:', err.message);
  }
}

/**
 * Deliver a Web Push notification payload to a single subscription.
 * Handles 404/410 cleanup and bounded retries for transient failures.
 */
async function sendPushToSubscription(subscriptionDoc, payload, maxRetries = 2) {
  const subObject = {
    endpoint: subscriptionDoc.endpoint,
    keys: {
      p256dh: subscriptionDoc.keys.p256dh,
      auth: subscriptionDoc.keys.auth
    }
  };

  const payloadString = JSON.stringify(payload);
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const result = await webpush.sendNotification(subObject, payloadString);
      subscriptionDoc.lastUsedAt = new Date();
      await subscriptionDoc.save();
      return { success: true, statusCode: result.statusCode };
    } catch (err) {
      const statusCode = err.statusCode;

      // HTTP 404 or 410 means subscription is invalid or expired: remove it from DB
      if (statusCode === 404 || statusCode === 410) {
        console.log(`[WebPush] Removing invalid subscription (HTTP ${statusCode}): ${subscriptionDoc.endpoint}`);
        await PushSubscription.deleteOne({ _id: subscriptionDoc._id });
        return { success: false, removed: true, statusCode };
      }

      // Transient errors: retry up to maxRetries
      attempt++;
      if (attempt > maxRetries) {
        console.error(`[WebPush] Push failed after ${maxRetries} retries (HTTP ${statusCode}):`, err.message);
        return { success: false, error: err.message, statusCode };
      }
    }
  }
}

/**
 * Deliver Web Push notifications to all active subscriptions of a recipient user.
 */
async function sendPushToUser(userId, payload) {
  const subscriptions = await PushSubscription.find({ user: userId });
  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, count: 0, delivered: 0 };
  }

  let deliveredCount = 0;
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushToSubscription(sub, payload))
  );

  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value && res.value.success) {
      deliveredCount++;
    }
  });

  return { success: true, count: subscriptions.length, delivered: deliveredCount };
}

function getVapidPublicKey() {
  return vapidKeys.publicKey;
}

module.exports = {
  sendPushToSubscription,
  sendPushToUser,
  getVapidPublicKey
};
