// backend/routes/studentRoutes.js
/*
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/studentController');

router.post('/', createStudent);
router.delete('/:id', deleteStudent);

*/
const express = require("express");
const router = express.Router();
const controller = require("../controllers/studentController");

router.get("/", controller.getStudents);
router.get("/:id", controller.getStudentById);
router.patch('/:id', controller.updateStudent);

module.exports = router;