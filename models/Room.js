const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Please provide room'],
      minlength: 8,
      maxlength: 20,
      unique: true,
    },
    capacity: {
      type: Number,
      default: 2,
      max: 10,
    },
    sfu: {
      type: Boolean,
      default: false,
    },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    user: {
      type: mongoose.Types.ObjectId,
      Ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', RoomSchema);
