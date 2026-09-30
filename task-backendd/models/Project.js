const mongoose = require("mongoose");

const projectMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  role: {
    type: String,
    enum: ["OWNER", "ADMIN", "MEMBER"],
    default: "MEMBER"
  }
}, { _id: false });

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    ownerType: {
      type: String,
      enum: ["User", "Team"],
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "ownerType",
      index: true
    },
    members: [projectMemberSchema],
    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED", "COMPLETED"],
      default: "ACTIVE"
    },
    deadline: {
      type: Date,
      default: null
    },
    tags: [{
      type: String,
      trim: true
    }],
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Compound index for efficient owner query lookup
projectSchema.index({ ownerId: 1, ownerType: 1 });

module.exports = mongoose.model("Project", projectSchema);
