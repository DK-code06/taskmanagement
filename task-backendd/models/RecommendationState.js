const mongoose = require('mongoose');

const recommendationStateSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    ruleType: {
      type: String,
      required: true,
      enum: [
        'REALLOCATE_WORKLOAD',
        'REBREAKDOWN_STAGNANT_TASK',
        'RESOLVE_BLOCKER',
        'ADJUST_DUE_DATE',
        'ARCHIVE_COMPLETED_PROJECT'
      ]
    },
    entityId: {
      type: String,
      default: null,
      index: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['DISMISSED'],
      default: 'DISMISSED'
    },
    dismissedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

recommendationStateSchema.index({ projectId: 1, ruleType: 1, entityId: 1, targetUserId: 1 });
recommendationStateSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('RecommendationState', recommendationStateSchema);
