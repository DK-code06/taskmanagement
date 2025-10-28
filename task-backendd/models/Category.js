const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  
  // Flexible ownership system
  // This field will store either 'User' or 'Team'
  ownerType: {
    type: String,
    required: true,
    enum: ['User', 'Team'],
  },
  // This field will store the _id of either the User or the Team
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'ownerType', // This tells Mongoose which model to reference
  },

  order: {
    type: Number,
    default: 0,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// This line is crucial. It creates and exports the model.
module.exports = mongoose.model("Category", CategorySchema);

