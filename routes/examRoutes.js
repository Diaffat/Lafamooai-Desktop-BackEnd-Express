const express = require('express');
const router = express.Router();
const controller = require('../controllers/examController');
const auth = require('../middlewars/auth');

// GET /exams - Get all exams with filtering
router.get('/', auth, controller.getExams);

// GET /exams/:id - Get exam by ID
router.get('/:id', auth, controller.getExamById);

// GET /exams/:id/assignments - Get assignments for exam
router.get('/:id/assignments', auth, controller.getExamAssignments);

// POST /exams - Create exam
router.post('/', auth, controller.createExam);

// PATCH /exams/:id - Update exam
router.patch('/:id', auth, controller.updateExam);

// DELETE /exams/:id - Delete exam
router.delete('/:id', auth, controller.deleteExam);

module.exports = router;
