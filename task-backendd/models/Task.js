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
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done', 'READY', 'BLOCKED', 'COMPLETED'],
      default: 'To Do'
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    estimatedCompletionTime: {
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

module.exports = mongoose.model("Task", taskSchema);
