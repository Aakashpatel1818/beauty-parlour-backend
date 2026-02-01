const express = require('express');
const router = express.Router();
// const auth = require('../middleware/auth');
const bookingCtrl = require('../controllers/bookingController'); // Extend for admin

router.get('/bookings',  /* admin get all bookings */ );

module.exports = router;