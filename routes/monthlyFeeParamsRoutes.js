const express = require('express');
const router = express.Router();
const controller = require('../controllers/monthlyFeeParamsController');
auth = require('../middlewars/auth');

router.use(auth);
router.get('/', controller.getMonthlyFeeParams);
router.get('/:id', controller.getMonthlyFeeParamById);
router.post('/', controller.createMonthlyFeeParam);
router.patch('/:id', controller.updateMonthlyFeeParam);
router.delete('/:id', controller.deleteMonthlyFeeParam);

module.exports = router;
