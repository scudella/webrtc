import { UserRole } from './user.interface.ts';

export interface CustomUser {
  userId: string;
  role: UserRole;
}

// Declaration Merging to extend the Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: CustomUser;
    }
  }
}
