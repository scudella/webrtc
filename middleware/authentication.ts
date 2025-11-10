import * as dotenv from 'dotenv';
import * as CustomError from '../errors/index.js';
import { isTokenValid, attachCookiesToResponse } from '../utils/index.js';
import Token from '../models/Token.js';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '../types/user.interface.js';
import { request } from 'websocket';

dotenv.config();

const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

const authorizePermissions = (...roles: UserRole[]): RequestHandler => {
  return (req: Request, _: Response, next: NextFunction) => {
    if (req.user?.role && !roles.includes(req.user.role)) {
      throw new CustomError.UnauthorizedError(
        'Unauthorized to access this route'
      );
    }
    next();
  };
};

const authenticateWsUser = async (req: request): Promise<void> => {
  let refreshToken, accessToken;
  req.cookies.forEach((cookie: Record<string, any>) => {
    const { name } = cookie;
    if (process.env.JWT_SECRET && name === 'refreshToken') {
      refreshToken = cookieParser.signedCookie(
        cookie.value,
        process.env.JWT_SECRET
      );
    } else if (process.env.JWT_SECRET && name === 'accessToken') {
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

export { authenticateUser, authorizePermissions, authenticateWsUser };
