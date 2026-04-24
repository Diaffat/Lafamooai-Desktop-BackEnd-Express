const express = require('express');
const router = express.Router();
const controller = require('../controllers/enrollmentDetailsController');
const auth = require('../middlewars/auth');

// GET /enrollment-details - List all enrollments
router.get('/', auth, controller.getEnrollmentList);

// POST /enrollment-details/validate - Validate enrollment (accept/reject)
router.post('/validate', auth, controller.enrollmentValidation);

// GET /enrollment-details/:id - Get enrollment details
router.get('/:id', auth, controller.getEnrollmentDetails);

module.exports = router;
