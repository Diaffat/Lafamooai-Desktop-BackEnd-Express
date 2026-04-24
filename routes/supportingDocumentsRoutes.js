const express = require('express');
const router = express.Router();
const controller = require('../controllers/supportingDocumentsController');
const auth = require('../middlewars/auth');

// GET /supporting-documents - Get all documents
router.get('/', auth, controller.getDocuments);

// POST /supporting-documents - Upload document
router.post('/', auth, controller.upload, controller.uploadDocument);

// GET /supporting-documents/:id - Get document by ID
router.get('/:id', auth, controller.getDocumentById);

// DELETE /supporting-documents/:id - Delete document
router.delete('/:id', auth, controller.deleteDocument);

module.exports = router;
