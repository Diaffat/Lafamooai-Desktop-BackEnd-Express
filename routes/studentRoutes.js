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

*/
const express = require("express");
const router = express.Router();
const controller = require("../controllers/studentController");

router.get("/", controller.getStudents);
router.get("/:id", controller.getStudentById);
router.patch('/:id', controller.updateStudent);
router.delete('/:id', controller.deleteStudent);


module.exports = router;