const prisma = require('../prisma');
const multer = require('multer');
const path = require('path');

const BASE_URL = process.env.BASE_URL ; // Ensure this is set in .env

// Utility function to build full document URL
const buildDocumentUrl = (doc) => {
  if (doc && doc.document && !doc.document.startsWith('http')) {
    return {
      ...doc,
      document: `${BASE_URL}/media/${doc.document}`
    };
  }
  return doc;
};

// Apply to array of documents
const buildDocumentUrls = (docs) => {
  return Array.isArray(docs) ? docs.map(buildDocumentUrl) : buildDocumentUrl(docs);
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../media/documents'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for documents
});

// Middleware to handle any file upload field name
const handleFileUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Upload document for student enrollment
exports.uploadDocument = async (req, res) => {
  try {
    // Get file from req.files array (from multer.any())
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const studentId = req.body.student_id;
    if (!studentId) {
      return res.status(400).json({ error: "L'ID de l'étudiant est requis." });
    }

    const uploadedFile = req.files[0];
    const document = await prisma.enrollement_supporting_dcuments.create({
      data: {
        studentId: parseInt(studentId, 10),
        document: `documents/${uploadedFile.filename}`
      }
    });

    res.status(201).json(buildDocumentUrl(document));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all documents
exports.getDocuments = async (req, res) => {
  try {
    const documents = await prisma.enrollement_supporting_dcuments.findMany({
      include: { student: true }
    });

    res.json({ results: buildDocumentUrls(documents) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get document by ID
exports.getDocumentById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    const document = await prisma.enrollement_supporting_dcuments.findUnique({
      where: { id: id },
      include: { student: true }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(buildDocumentUrl(document));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid document id' });
    }

    await prisma.enrollement_supporting_dcuments.delete({
      where: { id: id }
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Export multer middleware
exports.upload = handleFileUpload;
