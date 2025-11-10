import User from '../models/User.js';
import { StatusCodes } from 'http-status-codes';
import * as CustomError from '../errors/index.js';
import {
  createTokenUser,
  attachCookiesToResponse,
  checkPermissions,
} from '../utils/index.js';
import { Request, Response } from 'express';
import { IUserDocument } from '../types/user.interface.js';

interface UpdateUserPasswordBody {
  oldPassword: string;
  newPassword: string;
}

const getAllUsers = async (_: Request, res: Response): Promise<void> => {
  const users = await User.find({ role: 'user' }).select('-password');
  res.status(StatusCodes.OK).json({ users });
};

const getSingleUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = await User.findOne({ _id: id }).select('-password');

  if (!user) {
    throw new CustomError.NotFoundError(`No user with id : ${id}`);
  }
  checkPermissions(req.user, user._id.toHexString());
  res.status(StatusCodes.OK).json({ user });
};

const showCurrentUser = (req: Request, res: Response): void => {
  res.status(StatusCodes.OK).json({ user: req.user });
};

const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { name, email } = req.body;
  if (!name || !email) {
    throw new CustomError.BadRequestError('Please, provide all values');
  }
  const user: IUserDocument | null = await User.findOneAndUpdate(
    { _id: req.user?.userId },
    { name, email },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new CustomError.NotFoundError('User not found');
  }

  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser, refreshToken: '' });
  res.status(StatusCodes.OK).json({ user: tokenUser });
};

const updateUserPassword = async (
  req: Request<{}, {}, UpdateUserPasswordBody>,
  res: Response
): Promise<void> => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new CustomError.BadRequestError('Please provide both values');
  }

  const user = await User.findById(req.user?.userId);

  if (!user) {
    throw new CustomError.NotFoundError('User not found');
  }

  const isPasswordCorrect = await user.comparePassword(oldPassword);

  if (!isPasswordCorrect) {
    throw new CustomError.UnauthenticatedError('Invalid credentials');
  }

  user.password = newPassword;
  await user.save();

  res.status(StatusCodes.OK).json({ msg: 'Success! Password updated' });
};

export {
  getAllUsers,
  getSingleUser,
  showCurrentUser,
  updateUser,
  updateUserPassword,
};
