// routes/user.routes.js
const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');
const controller = require("../controllers/userController");
const auth = require("../middlewars/auth");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../media/users'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

router.post("/create_user", controller.createUser);
router.get("/", controller.getUsers);
router.get("/stats", controller.getStats);
router.get("/admin_dash", controller.adminDash);
router.patch("/:id", auth, handleFileUpload, controller.updateUser);
router.get("/:id", controller.getUserById);

module.exports = router;