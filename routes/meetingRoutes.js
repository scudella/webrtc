const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/authentication');
const { updateRoom } = require('../controllers/meetingController');

router.route('/update-room').post(authenticateUser, updateRoom);

module.exports = router;
