import express from 'express';
import { authenticateUser } from '../middleware/authentication.js';
import { updateRoom, showMyRoom } from '../controllers/meetingController.js';

const router = express.Router();
router.route('/update-room').post(authenticateUser, updateRoom);
router.route('/show-my-room').get(authenticateUser, showMyRoom);

export default router;
