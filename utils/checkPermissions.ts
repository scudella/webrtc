import * as CustomError from '../errors/index.js';
import { CustomUser } from '../types/types.js';

const checkPermissions = (
  requestUser: CustomUser | undefined,
  resourceUserId: string
): void => {
  if (requestUser?.role === 'admin') return;
  if (requestUser?.userId === resourceUserId) return;
  throw new CustomError.UnauthorizedError('No authorized to access this route');
};

export default checkPermissions;
