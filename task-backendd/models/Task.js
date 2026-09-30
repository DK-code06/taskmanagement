const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true
    },
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
      default: null,
      index: true
    },
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done', 'READY', 'BLOCKED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'READY'
    },
    order: { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low', 'No Priority'],
      default: 'No Priority'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    user: { // Creator user
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    category: { // Legacy category reference maintained for backward compatibility
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true
    },
    tags: [{
      type: String,
      trim: true
    }],
    dueDate: {
      type: Date,
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    estimatedMinutes: {
      type: Number,
      default: 0
    },
    estimatedCompletionTime: {
      type: Number,
      default: null
    },
    actualMinutes: {
      type: Number,
      default: 0
    },
    completedAt: {
      type: Date,
      default: null
    },
    rewardGranted: {
      type: Boolean,
      default: false
    },
    comments: [commentSchema],
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, milestoneId: 1 });
taskSchema.index({ parentTaskId: 1 });

module.exports = mongoose.model("Task", taskSchema);
