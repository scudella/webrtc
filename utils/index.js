const { createJWT, isTokenValid, attachCookiesToResponse } = require('./jwt');
const { verifyGoogleJWT } = require('./googleJwt');
const createTokenUser = require('./createTokenUser');
const checkPermissions = require('./checkPermissions');
const sendVerificationEmail = require('./sendVerificationEmail');
const sendResetPasswordEmail = require('./sendResetPasswordEmail');
const createHash = require('./createHash');
const { logError, logComment } = require('./logs');
const { defaultPasswordConfig } = require('./strongPassword');
const { avatar } = require('./avatar');

module.exports = {
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
  defaultPasswordConfig,
  avatar,
};
