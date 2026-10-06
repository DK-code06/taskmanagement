const mongoose = require('mongoose');

const gitHubSyncMappingSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    githubRepoId: {
      type: String,
      required: true
    },
    entityType: {
      type: String,
      enum: ['PR', 'COMMIT', 'ISSUE'],
      required: true
    },
    referenceId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    url: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      default: 'OPEN'
    }
  },
  {
    timestamps: true
  }
);

gitHubSyncMappingSchema.index(
  { taskId: 1, githubRepoId: 1, entityType: 1, referenceId: 1 },
  { unique: true }
);

module.exports = mongoose.model('GitHubSyncMapping', gitHubSyncMappingSchema);
