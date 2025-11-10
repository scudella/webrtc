import { HydratedDocument } from 'mongoose';

export type UserRole = 'admin' | 'user' | 'sfuser';

export interface IUser {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  verificationToken?: string;
  isVerified: boolean;
  verified?: Date;
  passwordToken?: string;
  passwordTokenExpirationDate?: Date;
  sub?: string;
  picture?: string;
}

export interface IUserMethods {
  comparePassword: (candidatePassword: string) => Promise<boolean>;
}

export type IUserDocument = HydratedDocument<IUser, IUserMethods>;
