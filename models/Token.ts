import mongoose, { Schema, Model } from 'mongoose';
import { ITokenDocument } from '../types/token.interface.js';

type TokenModelType = Model<ITokenDocument>;

const TokenSchema: Schema = new Schema(
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

const TokenModel = mongoose.model<ITokenDocument, TokenModelType>(
  'Token',
  TokenSchema
);
export default TokenModel;
