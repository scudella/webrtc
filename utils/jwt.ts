import jwt from 'jsonwebtoken';
import { Response } from 'express';
import * as dotenv from 'dotenv';
import { UserToken } from './createTokenUser.js';
import * as CustomError from '../errors/index.js';

dotenv.config();

export interface JwtPayload {
  user: UserToken;
  refreshToken?: string;
  iat: number;
  exp: number;
}

const createJWT = ({
  payload,
}: {
  payload: { user: UserToken; refreshToken?: string };
}): string => {
  if (!process.env.JWT_SECRET) {
    throw new CustomError.CustomAPIError(
      'Internal server error. No jwt secret.'
    );
  }
  const token = jwt.sign(payload, process.env.JWT_SECRET);
  return token;
};

const attachCookiesToResponse = ({
  res,
  user,
  refreshToken,
}: {
  res: Response;
  user: UserToken;
  refreshToken: string | undefined;
}): void => {
  const accessTokenJWT = createJWT({ payload: { user } });

  const oneDay = 1000 * 60 * 60 * 24;
  const longerExp = 1000 * 60 * 60 * 24 * 30;
  res.cookie('accessToken', accessTokenJWT, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    expires: new Date(Date.now() + oneDay),
  });

  if (refreshToken) {
    const refreshTokenJWT = createJWT({ payload: { user, refreshToken } });
    res.cookie('refreshToken', refreshTokenJWT, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      signed: true,
      expires: new Date(Date.now() + longerExp),
    });
  }
};

const isTokenValid = (token: string): JwtPayload => {
  if (!process.env.JWT_SECRET) {
    throw new CustomError.CustomAPIError(
      'Internal server error. No jwt secret.'
    );
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);

  if (typeof payload === 'string') {
    throw new CustomError.CustomAPIError('Invalid token format.');
  }
  return payload as JwtPayload;
};

export { createJWT, isTokenValid, attachCookiesToResponse };
