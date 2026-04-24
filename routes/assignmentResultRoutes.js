const express = require('express');
const router = express.Router();
const controller = require('../controllers/assignmentResultController');
const auth = require('../middlewars/auth');

// GET /assignment-results - Get all assignment results with filtering
router.get('/', auth, controller.getAssignmentResults);

// GET /assignment-results/by-assignment - Get results for specific assignment
router.get('/by_assign/action', auth, controller.getAssignmentResultsByAssignment);

// GET /assignment-results/:id - Get assignment result by ID
router.get('/:id', auth, controller.getAssignmentResultById);

// POST /assignment-results - Create assignment result
router.post('/', auth, controller.createAssignmentResult);

// POST /assignment-results/launch-correction - Launch correction
router.post('/launch_correction/action', auth, controller.launchCorrection);

// PATCH /assignment-results/:id - Update assignment result
router.patch('/:id', auth, controller.updateAssignmentResult);

// DELETE /assignment-results/:id - Delete assignment result
router.delete('/:id', auth, controller.deleteAssignmentResult);

module.exports = router;
