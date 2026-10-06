const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // The user who sent the message
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The user who is receiving the message
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

messageSchema.index({ content: "text" });
messageSchema.index({ fromUser: 1, createdAt: -1 });
messageSchema.index({ toUser: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
