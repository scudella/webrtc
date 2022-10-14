const Room = require('../models/Room');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');

const updateRoom = async (req, res) => {
  const { name } = req.body;
  const userAgent = req.headers['user-agent'];
  const ip = req.ip;
  const { userId } = req.user;
  // Check for existing room
  const existingRoom = await Room.findOne({ name });

  if (!existingRoom) {
    // Found no room with this name
    // check if user already has a room
    const existingUser = await Room.findOne({ user: userId });
    if (existingUser) {
      // user has a room, update it
      const room = await Room.findOneAndUpdate(
        { userId },
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
      const room = await Room.create({
        name,
        ip,
        userAgent,
        user: userId,
      });
      res
        .status(StatusCodes.CREATED)
        .json({ msg: `Success! Room ${name} created!` });
    }
  } else {
    // Room already exist! Check if this user owns it
    if (existingRoom.user.toString() === userId) {
      // same user, update room
      const room = await Room.findOneAndUpdate(
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

module.exports = { updateRoom };
