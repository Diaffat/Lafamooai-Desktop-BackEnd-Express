const express = require("express");
const router = express.Router();
const controller = require("../controllers/adminController");
const auth = require("../middlewars/auth");

router.get("/", auth, controller.getAdmins);
router.get("/:id", auth, controller.getAdminById);
router.post("/", auth, controller.createAdmin);
router.patch("/:id", auth, controller.updateAdmin);
router.delete("/:id", auth, controller.deleteAdmin);

module.exports = router;
