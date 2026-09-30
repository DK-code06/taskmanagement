const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const friendSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'accepted'],
    required: true
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  sessionVersion: {
    type: Number,
    default: 1
  },
  refreshToken: {
    type: String,
    default: null
  },
  points: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  lastCompletionDate: {
    type: Date,
    default: null
  },
  friends: [friendSchema],
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);
