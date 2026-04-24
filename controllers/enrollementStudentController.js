const prisma = require("../prisma");

exports.getEnrollementStudents = async (req, res) => {
  try {
    const students = await prisma.enrollement_student_info.findMany({
      include: {
        enrollement: true,
        demanded_class_level: true,
      },
    });
    return res.json({ count: students.length, results: students });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getEnrollementStudentById = async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  if (Number.isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student id" });
  }

  try {
    const student = await prisma.enrollement_student_info.findUnique({
      where: { id_enrollement_student_info: studentId },
      include: {
        enrollement: true,
        demanded_class_level: true,
      },
    });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    return res.json(student);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
