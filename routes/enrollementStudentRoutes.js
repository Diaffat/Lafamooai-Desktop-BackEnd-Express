const express = require("express");
const router = express.Router();
const controller = require("../controllers/enrollementStudentController");

router.get("/", controller.getEnrollementStudents);
router.get("/:id", controller.getEnrollementStudentById);

module.exports = router;
