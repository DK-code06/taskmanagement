const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// This sub-schema defines the structure for an entry in a user's friends list.
const friendSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'accepted'], // Tracks friend request status
    required: true
  },
  unreadCount: {
    type: Number,
    default: 0 // Tracks unread chat messages from this friend
  }
}, { _id: false }); // _id: false means sub-documents won't get their own IDs


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
  // Gamification fields
  points: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  lastCompletionDate: {
    type: Date
  },
  // Array to store friends and friend requests
  friends: [friendSchema]
});

// Mongoose middleware to automatically hash the password before saving a user
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  
  // Hash the password with a salt round of 10
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);
