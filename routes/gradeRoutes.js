const express = require('express');
const router = express.Router();
const controller = require('../controllers/gradeController');
auth = require('../middlewars/auth');

router.use(auth);
router.get('/', controller.getGrades);
router.get('/:id', controller.getGradeById);
router.post('/', controller.createGrade);
router.patch('/:id', controller.updateGrade);
router.delete('/:id', controller.deleteGrade);

module.exports = router;
