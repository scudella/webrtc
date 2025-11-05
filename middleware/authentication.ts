require('dotenv').config();
const CustomError = require('../errors');
const { isTokenValid } = require('../utils');
const Token = require('../models/Token');
const { attachCookiesToResponse } = require('../utils');
const cookieParser = require('cookie-parser');

const authenticateUser = async (req, res, next) => {
  const { refreshToken, accessToken } = req.signedCookies;

  try {
    if (accessToken) {
      const payload = isTokenValid(accessToken);
      req.user = payload.user;
      return next();
    }
    const payload = isTokenValid(refreshToken);
    const existingToken = await Token.findOne({
      user: payload.user.userId,
      refreshToken: payload.refreshToken,
    });
    if (!existingToken || !existingToken?.isValid) {
      throw new CustomError.UnauthenticatedError('Authentication Invalid!');
    }
    attachCookiesToResponse({
      res,
      user: payload.user,
      refreshToken: existingToken.refreshToken,
    });
    req.user = payload.user;
    next();
  } catch (error) {
    throw new CustomError.UnauthenticatedError('Authentication Invalid!');
  }
};

const authorizePermissions = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new CustomError.UnauthorizedError(
        'Unauthorized to access this route'
      );
    }
    next();
  };
};

const authenticateWsUser = async (req) => {
  let refreshToken, accessToken;
  req.cookies.forEach((cookie) => {
    const { name } = cookie;
    if (name === 'refreshToken') {
      refreshToken = cookieParser.signedCookie(
        cookie.value,
        process.env.JWT_SECRET
      );
    } else if (name === 'accessToken') {
      accessToken = cookieParser.signedCookie(
        cookie.value,
        process.env.JWT_SECRET
      );
    }
  });
  try {
    if (accessToken) {
      const payload = isTokenValid(accessToken);
      req.user = payload.user;
      return;
    } else if (refreshToken) {
      const payload = isTokenValid(refreshToken);
      const existingToken = await Token.findOne({
        user: payload.user.userId,
        refreshToken: payload.refreshToken,
      });
      if (!existingToken || !existingToken?.isValid) {
        return;
      } else {
        req.user = payload.user;
        return;
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  authenticateUser,
  authorizePermissions,
  authenticateWsUser,
};
