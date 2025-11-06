import mongoose from 'mongoose';

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
      default: 5,
      max: 10,
    },
    sfu: {
      type: Boolean,
      default: false,
    },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    loginRequired: {
      type: Boolean,
      default: false,
    },
    sameDomain: { type: Boolean, default: false },
    ownerRequired: { type: Boolean, default: true },
    user: {
      type: mongoose.Types.ObjectId,
      Ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Room', RoomSchema);
