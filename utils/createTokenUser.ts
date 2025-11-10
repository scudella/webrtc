import { IUserDocument, UserRole } from '../types/user.interface.js';

export type UserToken = {
  name: string;
  email: string;
  userId: string;
  role: UserRole;
  picture: string | undefined;
};

const createTokenUser = (user: IUserDocument): UserToken => {
  return {
    name: user.name,
    email: user.email,
    userId: user._id.toHexString(),
    role: user.role,
    picture: user.picture,
  };
};

export default createTokenUser;
