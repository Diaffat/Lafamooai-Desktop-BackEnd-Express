const express = require('express');
const router = express.Router();
const controller = require('../controllers/schoolInfosController');
auth = require('../middlewars/auth');

router.use(auth);
router.get('/', controller.getSchoolInfos);
router.get('/:id', controller.getSchoolInfoById);
router.post('/', controller.createSchoolInfo);
router.patch('/:id', controller.updateSchoolInfo);
router.delete('/:id', controller.deleteSchoolInfo);

module.exports = router;
