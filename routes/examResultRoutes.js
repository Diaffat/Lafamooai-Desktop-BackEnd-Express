const express = require('express');
const router = express.Router();
const controller = require('../controllers/examResultController');
const auth = require('../middlewars/auth');

// GET /exam-results - Get all exam results with filtering
router.get('/', auth, controller.getExamResults);

// GET /exam-results/:id - Get exam result by ID
router.get('/:id', auth, controller.getExamResultById);

// GET /exam-results/report - Get report details
router.get('/report/details', auth, controller.getReport);

// GET /exam-results/:id/pdf - Download report as PDF
router.get('/:id/pdf', auth, controller.reportPdfDownloader);

// POST /exam-results - Create exam result
router.post('/', auth, controller.createExamResult);

// POST /exam-results/generate - Generate reports for exam
router.post('/generate_reports/action', auth, controller.generateReports);

// PATCH /exam-results/:id - Update exam result
router.patch('/:id', auth, controller.updateExamResult);

// DELETE /exam-results/:id - Delete exam result
router.delete('/:id', auth, controller.deleteExamResult);

module.exports = router;
