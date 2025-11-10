import { createJWT, isTokenValid, attachCookiesToResponse } from './jwt.js';
import { verifyGoogleJWT } from './googleJwt.js';
import createTokenUser from './createTokenUser.js';
import checkPermissions from './checkPermissions.js';
import sendVerificationEmail from './sendVerificationEmail.js';
import sendResetPasswordEmail from './sendResetPasswordEmail.js';
import createHash from './createHash.js';
import { logError, logComment } from './logs.js';
import { avatar } from './avatar.js';
import { sanitizeName, sanitizeEmail } from './sanitizeString.js';
import { emailValidator } from './validateEmail.js';

export {
  createJWT,
  isTokenValid,
  verifyGoogleJWT,
  attachCookiesToResponse,
  createTokenUser,
  checkPermissions,
  sendVerificationEmail,
  sendResetPasswordEmail,
  createHash,
  logError,
  logComment,
  avatar,
  sanitizeName,
  sanitizeEmail,
  emailValidator,
};
