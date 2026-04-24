const express = require("express");
const router = express.Router();
const controller = require("../controllers/enrollementController");

router.get("/", controller.getEnrollments);
router.get("/get_stats", controller.getStats);
router.get("/:id", controller.getEnrollmentById);
router.post("/custom_create", controller.customCreate);
router.patch("/:id/custom_update", controller.customUpdate);
router.delete("/:id", controller.deleteEnrollment);
router.get("/:id/accept", controller.accept);

module.exports = router;
