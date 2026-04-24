const express = require('express');
const router = express.Router();
const controller = require('../controllers/monthlyFeeStatsController');
const auth = require('../middlewars/auth');

router.use(auth);
router.get('/', controller.getMonthlyFeeStats);
router.get('/:id', controller.getMonthlyFeeStatById);
router.post('/', controller.createMonthlyFeeStat);
router.put('/:id', controller.updateMonthlyFeeStat);
router.patch('/:id', controller.updateMonthlyFeeStat);
router.delete('/:id', controller.deleteMonthlyFeeStat);

module.exports = router;
