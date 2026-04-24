const express = require('express');
const router = express.Router();
const controller = require('../controllers/monthlyFeeDetailsController');
const auth = require('../middlewars/auth');

router.use(auth);
router.get('/financial_stats', controller.financialStats);
router.get('/payement_infos', controller.payementInfos);
router.post('/make_payement', controller.makePayement);
router.post('/student_payements', controller.studentPayements);
router.get('/:id/create_receipt', controller.createReceipt);
router.get('/:id', controller.getMonthlyFeeDetailById);
router.get('/', controller.getMonthlyFeeDetails);

module.exports = router;
