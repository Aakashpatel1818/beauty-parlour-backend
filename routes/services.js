const express = require('express');
const router = express.Router();
const serviceCtrl = require('../controllers/serviceController');
// const auth = require('../middleware/auth');

router.post('/', serviceCtrl.createService);
router.get('/', serviceCtrl.getServices);

module.exports = router;