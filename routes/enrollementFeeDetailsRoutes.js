const express = require('express');
const router = express.Router();
const controller = require('../controllers/enrollementFeeDetailsController');
const auth = require('../middlewars/auth');

router.use(auth);
router.post('/add_new_enrol', controller.addNewEnrol);
router.get('/', controller.getEnrollementFeeDetails);
router.get('/:id', controller.getEnrollementFeeDetailById);
router.post('/', controller.createEnrollementFeeDetail);
router.put('/:id', controller.updateEnrollementFeeDetail);
router.patch('/:id', controller.updateEnrollementFeeDetail);
router.delete('/:id', controller.deleteEnrollementFeeDetail);

module.exports = router;
