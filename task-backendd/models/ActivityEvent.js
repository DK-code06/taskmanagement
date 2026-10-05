const mongoose = require("mongoose");

const activityEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        "PROJECT_CREATED",
        "PROJECT_UPDATED",
        "PROJECT_ARCHIVED",
        "MILESTONE_CREATED",
        "MILESTONE_COMPLETED",
        "TASK_CREATED",
        "TASK_UPDATED",
        "TASK_COMPLETED",
        "TASK_REOPENED",
        "TASK_ASSIGNED",
        "TASK_UNASSIGNED",
        "TASK_DUE_DATE_CHANGED",
        "TASK_POSTPONED",
        "TASK_STATUS_CHANGED",
        "SUBTASK_CREATED",
        "SUBTASK_COMPLETED",
        "SUBTASK_REOPENED"
      ],
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true
    },
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      default: null
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

activityEventSchema.index({ eventType: 1, createdAt: -1 });
activityEventSchema.index({ projectId: 1, eventType: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityEvent", activityEventSchema);
