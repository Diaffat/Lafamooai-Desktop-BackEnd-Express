const prisma = require("../prisma");
const pageLimit = parseInt(process.env.pageLimit, 10);

// Get all assignments with filtering and pagination
exports.getAssignments = async (req, res) => {
  try {
    const { search, type, id } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const user = req.user;
    const where = {};
    let idInt = null;

    // Parse ID
    if (id && id !== "NaN" && id !== "") {
      idInt = parseInt(id, 10);
    }

    // Search filter
    if (search) {
      where.title = { contains: search };
    }

    // Class filter
    if (idInt) {
      where.subject = {
        classe: { id_class: idInt },
      };
    }

    // Type-based filter
    if (type && idInt) {
      if (type === "teacherId") {
        where.subject = { teacher: { id_teacher: idInt } };
      } else if (type === "classId") {
        where.subject = { classe: { id_class: idInt } };
      }
    }

    // Role-based filtering
    if (user.role === "admin") {
      // Admin sees all
    } else if (user.role === "teacher") {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.userId },
      });
      if (teacher) {
        where.subject = { teacherId: teacher.id_teacher };
      }
    } else if (user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { accountId: user.userId },
      });
      if (student) {
        where.subject = {
          classe: { students: { some: { id_student: student.id_student } } },
        };
      }
    } else if (user.role === "parent") {
      const students = await prisma.student.findMany({
        where: { parent: { user: { id: user.userId } } },
      });
      if (students.length > 0) {
        const studentIds = students.map((s) => s.id_student);
        where.subject = {
          classe: {
            students: { some: { id_student: { in: studentIds } } },
          },
        };
      } else {
        where.id_assignment = { in: [] };
      }
    }

    const total = await prisma.assignment.count({ where });
    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        subject: {
          include: {
            teacher: { include: { user: true } },
            classe: true,
          },
        },
        lessons: true,
      },
      orderBy: { id_assignment: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ count: total, results: assignments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get assignment by ID
exports.getAssignmentById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id_assignment: id },
      include: {
        subject: {
          include: {
            teacher: { include: { user: true } },
            classe: true,
          },
        },
        lessons: true,
        results: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Create assignment
exports.createAssignment = async (req, res) => {
  try {
    const {
      examId,
      asg_type,
      subjectId,
      startDate,
      dueDate,
      title,
      description,
    } = req.body;

    const assignment = await prisma.assignment.create({
      data: {
        ...(examId && { examId: parseInt(examId, 10) }),
        asg_type,
        ...(subjectId && { subjectId: parseInt(subjectId, 10) }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        title,
        description,
        correction_status: "Waiting",
      },
      include: {
        subject: {
          include: {
            teacher: { include: { user: true } },
            classe: true,
          },
        },
      },
    });

    res.status(201).json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update assignment
exports.updateAssignment = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }

    const {
      examId,
      asg_type,
      subjectId,
      startDate,
      dueDate,
      title,
      description,
      correction_status,
    } = req.body;

    const assignment = await prisma.assignment.update({
      where: { id_assignment: id },
      data: {
        ...(examId !== undefined && { examId: parseInt(examId, 10) }),
        ...(asg_type && { asg_type }),
        ...(subjectId && { subjectId: parseInt(subjectId, 10) }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(title && { title }),
        ...(description && { description }),
        ...(correction_status && { correction_status }),
      },
      include: {
        subject: {
          include: {
            teacher: { include: { user: true } },
            classe: true,
          },
        },
      },
    });

    if (correction_status === "Corrected" && assignment.examId) {
      const allAssignments = await prisma.assignment.findMany({
        where: { examId: assignment.examId },
      });
      const allAssignmentsCorrected = allAssignments.every(
        (a) => a.correction_status === "Corrected",
      );
      if (allAssignmentsCorrected) {
        await prisma.exam.update({
          where: { id_exam: assignment.examId },
          data: { status: "Corrected" },
        });
      }
    }

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }

    await prisma.assignment.delete({
      where: { id_assignment: id },
    });

    res.json({ message: "Assignment deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get assignments by exam
exports.getAssignmentsByExam = async (req, res) => {
  try {
    const examId = parseInt(req.query.exmid, 10);

    if (Number.isNaN(examId)) {
      return res.status(400).json({ error: "Invalid exam id" });
    }

    const exam = await prisma.exam.findUnique({
      where: { id_exam: examId },
    });

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const assignments = await prisma.assignment.findMany({
      where: { examId },
      include: {
        subject: {
          include: {
            teacher: { include: { user: true } },
            classe: true,
          },
        },
      },
    });

    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
