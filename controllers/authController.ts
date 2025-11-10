import * as dotenv from 'dotenv';
import User from '../models/User.js';
import Token from '../models/Token.js';
import { StatusCodes } from 'http-status-codes';
import * as CustomError from '../errors/index.js';
import {
  attachCookiesToResponse,
  createTokenUser,
  sendVerificationEmail,
  sendResetPasswordEmail,
  createHash,
  verifyGoogleJWT,
  sanitizeName,
  sanitizeEmail,
  logComment,
} from '../utils/index.js';
import crypto from 'crypto';
import generatePassword from 'omgopass';
import { avatar } from '../utils/avatar.js';
import { Request, Response } from 'express';

dotenv.config();

interface RegisterRequestBody {
  name: string;
  email: string;
  password: string;
}

interface LoginRequestBody {
  email: string;
  password: string;
  credential: string;
  checkbox: string;
}

interface VerifyEmailBody {
  verificationToken: string;
  email: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  email: string;
  password: string;
}

const register = async (
  req: Request<{}, {}, RegisterRequestBody>,
  res: Response
): Promise<void> => {
  const { name, email, password } = req.body;

  if (!sanitizeName(name)) {
    throw new CustomError.BadRequestError('Name contains special characters');
  }

  if (!sanitizeEmail(email)) {
    throw new CustomError.BadRequestError('Email malformed');
  }

  const emailAlreadyExists = await User.findOne({ email });

  if (emailAlreadyExists) {
    throw new CustomError.BadRequestError('Email already exists');
  }

  if (password.length < 8) {
    throw new CustomError.BadRequestError(
      'Password length is 8 or more characters'
    );
  }

  const role = 'user';

  const verificationToken = crypto.randomBytes(40).toString('hex');

  // Select a random avatar;
  const picture = avatar[Math.floor(Math.random() * avatar.length)];

  const user = await User.create({
    name,
    email,
    password,
    role,
    verificationToken,
    picture,
  });

  const origin = process.env.CLIENT_ORIGIN ?? 'https://localhost:5000';

  try {
    await sendVerificationEmail({
      name: user.name,
      email: user.email,
      verificationToken: user.verificationToken!,
      origin,
    });
  } catch (error) {
    logComment('Could not send the verification email for user registering.');
    await User.deleteOne(user._id);
    throw new Error('Server could not send the email.');
  }
  res.status(StatusCodes.CREATED).json({
    msg: 'Success! Please check your email to verify account',
  });
};

const login = async (
  req: Request<{}, {}, LoginRequestBody>,
  res: Response
): Promise<void> => {
  const { email, password, credential, checkbox } = req.body;
  let user;

  if (!credential && (!email || !password)) {
    throw new CustomError.BadRequestError('Please provide email and password');
  }

  // credential from google login
  if (credential) {
    try {
      const payload = await verifyGoogleJWT(credential);
      const email = payload?.email;
      const picture = payload?.picture ?? '';
      user = await User.findOne({ email });
      if (!user) {
        // user does not exist. register required and done here.
        // if exists nothing else required
        if (!payload?.email_verified) {
          throw new CustomError.BadRequestError(
            'Please provide valid gmail credentials'
          );
        }
        const password = generatePassword();
        user = await User.create({
          name: payload?.name,
          email,
          password,
          role: 'user',
          verificationToken: '',
          isVerified: true,
          verified: Date.now(),
          picture,
          sub: payload?.sub,
        });
      } else {
        if (checkbox) {
          await User.findOneAndUpdate({ email }, { picture });
          user.picture = payload?.picture;
        }
      }
    } catch (error) {
      throw new CustomError.BadRequestError(
        'Please provide valid gmail credentials'
      );
    }
    // email and password for regular login
  } else {
    user = await User.findOne({ email });
    if (!user) {
      throw new CustomError.UnauthenticatedError('Invalid Credentials');
    }
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      throw new CustomError.UnauthenticatedError('Invalid Credentials');
    }

    if (!user.isVerified) {
      throw new CustomError.UnauthenticatedError('Please, verify your email');
    }
  }

  // same path for regular login or google login
  const tokenUser = createTokenUser(user);

  // create refresh token
  let refreshToken = '';

  // check for existing token
  const existingToken = await Token.findOne({ user: user._id });
  if (existingToken) {
    // the isValid should be always true. If a user is giving a hard time
    // it can be - at this point - manually disabled at the database
    const { isValid } = existingToken;
    if (!isValid) {
      throw new CustomError.UnauthenticatedError('Invalid credentials');
    }
    refreshToken = existingToken.refreshToken;
    attachCookiesToResponse({ res, user: tokenUser, refreshToken });
    res.status(StatusCodes.OK).json({ user: tokenUser });
    return;
  }

  refreshToken = crypto.randomBytes(40).toString('hex');
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;
  const userToken = { refreshToken, ip, userAgent, user: user._id };

  await Token.create(userToken);

  attachCookiesToResponse({ res, user: tokenUser, refreshToken });
  res.status(StatusCodes.OK).json({ user: tokenUser });
};

const logout = async (req: Request, res: Response): Promise<void> => {
  await Token.findOneAndDelete({ user: req.user?.userId });
  res.cookie('accessToken', 'random string', {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.cookie('refreshToken', 'random string', {
    httpOnly: true,
    expires: new Date(Date.now()),
  });
  res.status(StatusCodes.OK).json({ msg: 'user logged out!' });
};

const verifyEmail = async (
  req: Request<{}, {}, VerifyEmailBody>,
  res: Response
): Promise<void> => {
  const { verificationToken, email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    throw new CustomError.UnauthenticatedError('Verification failed');
  }

  if (user.verificationToken !== verificationToken) {
    throw new CustomError.UnauthenticatedError('Verification failed');
  }

  await User.findOneAndUpdate(
    { email },
    { isVerified: true, verified: Date.now(), verificationToken: '' },
    { new: true, runValidators: true }
  );

  res.status(StatusCodes.OK).json({ msg: 'Email verified' });
};

const forgotPassword = async (
  req: Request<{}, {}, ForgotPasswordBody>,
  res: Response
): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    throw new CustomError.BadRequestError('Please provide valid email');
  }

  const user = await User.findOne({ email });

  if (user && user.isVerified) {
    const passwordToken = crypto.randomBytes(70).toString('hex');
    // send email
    const origin = process.env.CLIENT_ORIGIN ?? 'https://localhost:5000';
    await sendResetPasswordEmail({
      name: user.name,
      email: user.email,
      token: passwordToken,
      origin,
    });

    const passwordTokenHashed = createHash(passwordToken);

    const tenMinutes = 1000 * 60 * 10;
    const passwordTokenExpirationDate = new Date(Date.now() + tenMinutes);
    await User.findOneAndUpdate(
      { email },
      { passwordToken: passwordTokenHashed, passwordTokenExpirationDate },
      { new: true, runValidators: true }
    );
    res
      .status(StatusCodes.OK)
      .json({ msg: 'Please check your email for reset password link' });
  } else {
    throw new CustomError.UnauthenticatedError('Please, verify your email');
  }
};

const resetPassword = async (
  req: Request<{}, {}, ResetPasswordBody>,
  res: Response
): Promise<void> => {
  const { token, email, password } = req.body;
  if (!token || !email || !password) {
    throw new CustomError.BadRequestError('Please provide all values');
  }
  const user = await User.findOne({ email });
  if (user) {
    const currentDate = new Date();
    if (
      user.passwordToken === createHash(token) &&
      user.passwordTokenExpirationDate &&
      user.passwordTokenExpirationDate > currentDate
    ) {
      user.password = password;
      user.passwordToken = undefined;
      user.passwordTokenExpirationDate = undefined;
      await user.save();
    }
  }
  res.send('reset password');
};

const showWebId = (_: Request, res: Response): void => {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  res.status(StatusCodes.OK).json({ clientId });
};

const showAndroidId = (_: Request, res: Response): void => {
  const clientId = process.env.GOOGLE_ANDROID_CLIENT_ID;
  res.status(StatusCodes.OK).json({ clientId });
};

export {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  showWebId,
  showAndroidId,
};
