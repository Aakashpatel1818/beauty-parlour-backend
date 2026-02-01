const express = require('express');
const router = express.Router();
const timeSlotCtrl = require('../controllers/timeSlotController');
// const auth = require('../middleware/auth');

router.get('/', timeSlotCtrl.getTimeSlots);
router.post('/block', timeSlotCtrl.blockSlot);

module.exports = router;