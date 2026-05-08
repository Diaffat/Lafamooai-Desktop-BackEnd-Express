const express = require("express");
const router = express.Router();
const controller = require("../controllers/teacherController");
const auth = require("../middlewars/auth");

// GET /teachers - Get all teachers with search filter (PUBLIC - no auth required)
router.get("/", controller.getTeachers);

// GET /teachers/:id - Get teacher by ID
router.get("/:id", auth, controller.getTeacherById);

// POST /teachers - Create teacher
router.post("/", auth, controller.createTeacher);

// PATCH /teachers/:id - Update teacher
router.patch("/:id", auth, controller.updateTeacher);

// DELETE /teachers/:id - Delete teacher
router.delete("/:id", auth, controller.deleteTeacher);

module.exports = router;