const express = require("express");

const router = express.Router();

const {
  createLicense,
  activateLicense,
  verifyLicense
} = require("../controllers/licenseController");

router.post("/", createLicense);
router.post("/activate", activateLicense);
router.post("/verify", verifyLicense);

module.exports = router;