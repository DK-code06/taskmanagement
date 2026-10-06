const mongoose = require('mongoose');

const gitHubWebhookLogSchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    eventType: {
      type: String,
      required: true
    },
    repositoryFullName: {
      type: String,
      default: ''
    },
    processedStatus: {
      type: String,
      enum: ['RECEIVED', 'PROCESSING', 'SUCCESS', 'IGNORED', 'FAILED'],
      default: 'PROCESSING'
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7-day TTL index
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('GitHubWebhookLog', gitHubWebhookLogSchema);
