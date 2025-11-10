import mongoose, { Schema, Model } from 'mongoose';
import { IRoomDocument } from '../types/room.interface.js';

type RoomModelType = Model<IRoomDocument>;

const RoomSchema: Schema = new Schema(
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

const RoomModel = mongoose.model<IRoomDocument, RoomModelType>(
  'Room',
  RoomSchema
);
export default RoomModel;
