import Room from '../models/Room.js';
import { StatusCodes } from 'http-status-codes';
import * as CustomError from '../errors/index.js';
import { Request, Response } from 'express';

interface UpdateRoomBody {
  name: string;
}

const updateRoom = async (
  req: Request<{}, {}, UpdateRoomBody>,
  res: Response
): Promise<void> => {
  const { name } = req.body;
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;

  // Check for existing room
  const existingRoom = await Room.findOne({ name });

  if (!existingRoom) {
    // Found no room with this name
    // check if user already has a room
    const existingUser = await Room.findOne({ user: req.user?.userId });
    if (existingUser) {
      // user has a room, update it
      await Room.findOneAndUpdate(
        { user: req.user?.userId },
        {
          name,
          ip,
          userAgent,
        }
      );
      res
        .status(StatusCodes.OK)
        .json({ msg: `User already has a room; updated to ${name}` });
    } else {
      // user has no room; create it
      await Room.create({
        name,
        ip,
        userAgent,
        user: req.user?.userId,
      });
      res
        .status(StatusCodes.CREATED)
        .json({ msg: `Success! Room ${name} created!` });
    }
  } else {
    // Room already exist! Check if this user owns it
    if (existingRoom.user.toString() === req.user?.userId) {
      // same user, update room
      await Room.findOneAndUpdate(
        { name },
        {
          ip,
          userAgent,
        }
      );
      res.status(StatusCodes.OK).json({ msg: `Room ${name} updated` });
    } else {
      // different user owner
      throw new CustomError.UnauthorizedError(
        'Please, choose another room name'
      );
    }
  }
};

const showMyRoom = async (req: Request, res: Response): Promise<void> => {
  const existingRoom = await Room.findOne({ user: req.user?.userId });
  if (existingRoom) {
    res.status(StatusCodes.OK).json({ room: existingRoom.name });
  } else {
    throw new CustomError.NotFoundError('No meeting created');
  }
};

export { updateRoom, showMyRoom };
