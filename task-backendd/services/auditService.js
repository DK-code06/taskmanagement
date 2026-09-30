const AuditLog = require('../models/AuditLog');

/**
 * Log a security-sensitive event to the AuditLog collection.
 */
async function logAuditEvent({ userId = null, action, req = null, details = {} }) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    await AuditLog.create({
      userId,
      action,
      ipAddress,
      userAgent,
      details
    });
  } catch (err) {
    console.error(`❌ Failed to write AuditLog (${action}):`, err.message);
  }
}

module.exports = { logAuditEvent };
