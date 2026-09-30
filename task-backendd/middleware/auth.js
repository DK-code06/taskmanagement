const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAuditEvent } = require('../services/auditService');
require('dotenv').config();

const auth = async (req, res, next) => {
  let token = req.header('Authorization')?.split(' ')[1];
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check session version against DB to support instant "Logout All Devices"
    const user = await User.findById(decoded.id).select('username sessionVersion timezone points streak');
    if (!user || user.deletedAt) {
      return res.status(401).json({ error: 'User account not found or deactivated' });
    }

    if (decoded.sessionVersion !== undefined && user.sessionVersion !== decoded.sessionVersion) {
      logAuditEvent({ userId: user._id, action: 'PERMISSION_DENIED', req, details: { reason: 'SESSION_REVOKED' } });
      return res.status(401).json({ error: 'Session has been invalidated. Please log in again.' });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      timezone: user.timezone || 'UTC',
      sessionVersion: user.sessionVersion
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expiredAt: err.expiredAt });
    }
    return res.status(401).json({ error: 'Invalid token signature' });
  }
};

module.exports = auth;