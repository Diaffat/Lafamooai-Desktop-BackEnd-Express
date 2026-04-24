// controllers/student.controller.js
const prisma = require("../prisma");
const { serializeStudent } = require("../serializers/studentSerializer");
const pageLimit = parseInt(process.env.pageLimit, 10);
exports.getStudents = async (req, res) => {
  try {
    const { search, gender } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const where = {};

    if (search) {
      where.account = {
        OR: [
          { username: { contains: search } },
          { email: { contains: search } },
          { tel: { contains: search } },
          { address: { contains: search } },
        ],
      };
    }

    if (gender) {
      where.gender = gender;
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        account: true,
        parent: {
          include: {
            user: true,
          },
        },
        classe: true,
      },
      orderBy: {
        id_student: "asc",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      count: students.length,
      results: students.map(serializeStudent),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getStudentById = async (req, res) => {
  const { id } = req.params;
  const studentId = parseInt(id, 10);

  if (Number.isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student id" });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id_student: studentId },
      include: {
        account: true,
        parent: {
          include: {
            user: true,
          },
        },
        classe: true,
      },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(serializeStudent(student));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
