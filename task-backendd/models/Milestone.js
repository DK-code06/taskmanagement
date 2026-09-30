const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    dueDate: {
      type: Date,
      default: null
    },
    order: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["PLANNED", "IN_PROGRESS", "COMPLETED"],
      default: "PLANNED"
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

milestoneSchema.index({ projectId: 1, order: 1 });

module.exports = mongoose.model("Milestone", milestoneSchema);
