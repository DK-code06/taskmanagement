const mongoose = require('mongoose');

const gitHubRepositoryLinkSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    githubRepoId: {
      type: String,
      required: true,
      index: true
    },
    owner: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    private: {
      type: Boolean,
      default: false
    },
    defaultBranch: {
      type: String,
      default: 'main'
    },
    autoCloseOnPRMerge: {
      type: Boolean,
      default: true
    },
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    linkedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring the same GitHub repository cannot be linked twice to the same Project
gitHubRepositoryLinkSchema.index({ projectId: 1, githubRepoId: 1 }, { unique: true });

module.exports = mongoose.model('GitHubRepositoryLink', gitHubRepositoryLinkSchema);
