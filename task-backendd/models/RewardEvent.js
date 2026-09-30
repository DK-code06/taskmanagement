const mongoose = require('mongoose');

const rewardEventSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  points: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    default: 'TASK_COMPLETION'
  }
}, { timestamps: true });

// Compound unique index ensures 1 reward event per task ID and reason
rewardEventSchema.index({ taskId: 1, reason: 1 }, { unique: true });

module.exports = mongoose.model('RewardEvent', rewardEventSchema);
