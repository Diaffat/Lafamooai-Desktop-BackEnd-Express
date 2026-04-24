const express = require('express');
const router = express.Router();
const controller = require('../controllers/assignmentController');
const auth = require('../middlewars/auth');

// GET /assignments - Get all assignments with filtering
router.get('/', auth, controller.getAssignments);

// GET /assignments/by-exam - Get assignments by exam
router.get('/by_exam/action', auth, controller.getAssignmentsByExam);

// GET /assignments/:id - Get assignment by ID
router.get('/:id', auth, controller.getAssignmentById);

// POST /assignments - Create assignment
router.post('/', auth, controller.createAssignment);

// PATCH /assignments/:id - Update assignment
router.patch('/:id', auth, controller.updateAssignment);

// DELETE /assignments/:id - Delete assignment
router.delete('/:id', auth, controller.deleteAssignment);

module.exports = router;
