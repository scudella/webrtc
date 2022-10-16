const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/authentication');
const { updateRoom, showMyRoom } = require('../controllers/meetingController');

router.route('/update-room').post(authenticateUser, updateRoom);
router.route('/show-my-room').get(authenticateUser, showMyRoom);

module.exports = router;
