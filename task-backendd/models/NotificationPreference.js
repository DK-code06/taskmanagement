const mongoose = require('mongoose');

const channelPreferenceSchema = new mongoose.Schema({
  inApp: { type: Boolean, default: true },
  push: { type: Boolean, default: true }
}, { _id: false });

const notificationPreferenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  taskReminders: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  taskAssignment: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  taskCompletion: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  projectActivity: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  teamActivity: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  friendActivity: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  chatMessages: {
    type: channelPreferenceSchema,
    default: () => ({ inApp: true, push: true })
  },
  systemSecurity: {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: true }
  }
}, { timestamps: true });

// Static helper to get or initialize default preferences for a user
notificationPreferenceSchema.statics.getOrCreateForUser = async function(userId) {
  let prefs = await this.findOne({ user: userId });
  if (!prefs) {
    prefs = new this({ user: userId });
    await prefs.save();
  }
  return prefs;
};

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
