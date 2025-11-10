import mongoose, { Schema, Model } from 'mongoose';
import { IUserDocument } from '../types/user.interface.js';
import bcrypt from 'bcryptjs';
import { emailValidator } from '../utils/validateEmail.js';

type UserModelType = Model<IUserDocument>;

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide name'],
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      unique: true,
      required: [true, 'Please provide email'],
      validate: {
        validator: emailValidator,
        message: 'Please provide valid email',
      },
      maxlength: 30,
    },
    password: {
      type: String,
      required: [true, 'Please provide password'],
      minlength: 8,
      maxlength: 20,
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'sfuser'],
      default: 'user',
    },
    verificationToken: String,
    isVerified: {
      type: Boolean,
      default: false,
    },
    verified: Date,
    passwordToken: {
      type: String,
    },
    passwordTokenExpirationDate: {
      type: Date,
    },
    sub: {
      type: String,
      default: '',
    },
    picture: {
      type: String,
      maxlength: 120,
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (this: IUserDocument) {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password!, salt);
});

UserSchema.methods.comparePassword = async function (
  this: IUserDocument,
  candidatePassword: string
): Promise<boolean> {
  const isMatch = await bcrypt.compare(candidatePassword, this.password!);
  return isMatch;
};

const UserModel = mongoose.model<IUserDocument, UserModelType>(
  'User',
  UserSchema
);
export default UserModel;
