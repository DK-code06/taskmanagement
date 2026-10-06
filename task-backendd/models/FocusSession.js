const mongoose = require("mongoose");

const focusSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
      index: true
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastResumedAt: {
      type: Date,
      default: Date.now
    },
    pausedAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    accumulatedFocusedSeconds: {
      type: Number,
      default: 0,
      min: 0
    },
    pauseCount: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
);

// Partial unique index ensuring 1 User has at most 1 ACTIVE or PAUSED FocusSession
focusSessionSchema.index(
  { userId: 1, status: 1 },
  {
    partialFilterExpression: { status: { $in: ["ACTIVE", "PAUSED"] } },
    unique: true
  }
);

focusSessionSchema.index({ userId: 1, createdAt: -1 });
focusSessionSchema.index({ taskId: 1, status: 1 });

module.exports = mongoose.model("FocusSession", focusSessionSchema);
