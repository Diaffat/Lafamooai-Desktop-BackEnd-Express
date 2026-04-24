const express = require('express');
const router = express.Router();
const controller = require('../controllers/subjectController');
const auth = require('../middlewars/auth');

// GET /subjects - Get all subjects with filtering
router.get('/', auth, controller.getSubjects);

// POST /subjects/register_new - Create new subject (action custom)
router.post('/register_new', auth, controller.registerNew);

// GET /subjects/:id - Get subject by ID
router.get('/:id', auth, controller.getSubjectById);

// POST /subjects - Create subject (standard CRUD)
router.post('/', auth, controller.createSubject);

// PATCH /subjects/:id/custom_update - Custom update (action custom)
router.patch('/:id/custom_update', auth, controller.customUpdate);

// PATCH /subjects/:id - Update subject (standard CRUD)
router.patch('/:id', auth, controller.updateSubject);

// DELETE /subjects/:id - Delete subject
router.delete('/:id', auth, controller.deleteSubject);

module.exports = router;
