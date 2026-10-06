const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'LOGOUT_ALL',
      'PASSWORD_CHANGED',
      'PERMISSION_DENIED',
      'TOKEN_REFRESH',
      'GITHUB_CONNECTED',
      'GITHUB_DISCONNECTED',
      'GITHUB_CONNECTION_FAILED',
      'GITHUB_REPO_LINKED',
      'GITHUB_REPO_UNLINKED',
      'GITHUB_REPO_LINK_FAILED',
      'GITHUB_WEBHOOK_RECEIVED',
      'GITHUB_WEBHOOK_INVALID_SIGNATURE',
      'GITHUB_WEBHOOK_UNMAPPED_REPO',
      'GITHUB_PR_SYNCHRONIZED',
      'GITHUB_SYNC_FAILED'
    ],
    index: true
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
