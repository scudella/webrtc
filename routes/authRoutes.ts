import express from 'express';
import { authenticateUser } from '../middleware/authentication.js';

const router = express.Router();

import {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  showWebId,
  showAndroidId,
} from '../controllers/authController.js';

router.route('/register').post(register);
router.route('/login').post(login);
router.route('/logout').delete(authenticateUser, logout);
router.route('/verify-email').post(verifyEmail);
router.route('/forgot-password').post(forgotPassword);
router.route('/reset-password').post(resetPassword);
router.route('/show-web-id').get(showWebId);
router.route('/show-android-id').get(showAndroidId);

export default router;
