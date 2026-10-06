const mongoose = require('mongoose');

const gitHubConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    githubUserId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    githubUsername: {
      type: String,
      required: true,
      trim: true
    },
    encryptedAccessToken: {
      type: String,
      required: true
    },
    scope: {
      type: String,
      default: 'repo'
    },
    connectedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Defense-in-depth: Ensure encryptedAccessToken is excluded from default JSON serialization
gitHubConnectionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.encryptedAccessToken;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('GitHubConnection', gitHubConnectionSchema);
