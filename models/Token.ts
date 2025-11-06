import mongoose from 'mongoose';

const TokenSchema = new mongoose.Schema(
  {
    refreshToken: { type: String, required: true },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    isValid: { type: Boolean, default: true },
    user: {
      type: mongoose.Types.ObjectId,
      Ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Token', TokenSchema);
