const mongoose = require('mongoose');

const reminderJobSchema = new mongoose.Schema({
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
  reminderType: {
    type: String,
    enum: ['DUE_DATE', 'OVERDUE', 'CUSTOM'],
    default: 'DUE_DATE'
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'EXECUTED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  deduplicationKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

reminderJobSchema.index({ scheduledAt: 1, status: 1 });

module.exports = mongoose.model('ReminderJob', reminderJobSchema);
