const prisma = require("../prisma");
const pageLimit = parseInt(process.env.pageLimit, 10);

// Get all assignment results with filtering and pagination
exports.getAssignmentResults = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const user = req.user;
    const where = {};

    // Search filter
    if (search) {
      where.student = {
        account: {
          username: { contains: search },
        },
      };
    }

    // Role-based filtering
    if (user.role === "admin") {
      // Admin sees all
    } else if (user.role === "teacher") {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id },
      });
      if (teacher) {
        where.assignment = {
          subject: { teacherId: teacher.id_teacher },
        };
      }
    } else if (user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { accountId: user.id },
      });
      if (student) {
        where.studentId = student.id_student;
      }
    } else if (user.role === "parent") {
      const students = await prisma.student.findMany({
        where: { parent: { user: { id: user.id } } },
      });
      if (students.length > 0) {
        const studentIds = students.map((s) => s.id_student);
        where.studentId = { in: studentIds };
      } else {
        where.id_assign_result = { in: [] };
      }
    }

    const total = await prisma.assignmentResult.count({ where });
    const results = await prisma.assignmentResult.findMany({
      where,
      include: { student: true, assignment: true },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ count: total, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get assignment result by ID
exports.getAssignmentResultById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment result id" });
    }

    const result = await prisma.assignmentResult.findUnique({
      where: { id_assign_result: id },
      include: { student: true, assignment: true },
    });

    if (!result) {
      return res.status(404).json({ error: "Assignment result not found" });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Create assignment result
exports.createAssignmentResult = async (req, res) => {
  try {
    const { assignmentId, studentId, score } = req.body;

    const result = await prisma.assignmentResult.create({
      data: {
        assignmentId: parseInt(assignmentId, 10),
        studentId: parseInt(studentId, 10),
        ...(score !== undefined && { score: parseFloat(score) }),
      },
      include: { student: true, assignment: true },
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update assignment result (score)
exports.updateAssignmentResult = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment result id" });
    }

    const { score } = req.body;

    const result = await prisma.assignmentResult.update({
      where: { id_assign_result: id },
      data: {
        ...(score !== undefined && { score: parseFloat(score) }),
      },
      include: { student: true, assignment: true },
    });

    // La correction de l'assignement ne passe en "Corrected" que lorsque le professeur
    // clique sur "Terminer la correction" dans l'UI.
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete assignment result
exports.deleteAssignmentResult = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment result id" });
    }

    await prisma.assignmentResult.delete({
      where: { id_assign_result: id },
    });

    res.json({ message: "Assignment result deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Launch correction for an assignment
exports.launchCorrection = async (req, res) => {
  try {
    const user = req.user;
    const { assign_id, class_id } = req.body;

    const assignId = parseInt(assign_id, 10);
    const classId = parseInt(class_id, 10);

    if (Number.isNaN(assignId) || Number.isNaN(classId)) {
      return res.status(400).json({ error: "Invalid assign_id or class_id" });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id_assignment: assignId },
    });

    const classe = await prisma.class.findUnique({
      where: { id_class: classId },
      include: { students: true },
    });

    if (!assignment || !classe) {
      return res.status(404).json({ error: "Assignment or class not found" });
    }

    const corrections = [];

    if (["Corrected", "Launched"].includes(assignment.correction_status)) {
      // Return existing results
      if (user.role === "student") {
        const student = await prisma.student.findFirst({
          where: { accountId: user.id },
        });
        if (student) {
          const assignRslt = await prisma.assignmentResult.findFirst({
            where: {
              assignmentId: assignId,
              studentId: student.id_student,
            },
            include: {
              assignment: {
                include: {
                  subject: {
                    include: { classe: true },
                  },
                },
              },
              student: true,
            },
          });
          if (assignRslt) {
            corrections.push(assignRslt);
          }
        }
      } else if (user.role === "parent") {
        const students = await prisma.student.findMany({
          where: {
            parent: { user: { id: user.id } },
            classeId: classId,
          },
        });
        for (const student of students) {
          const assignRslt = await prisma.assignmentResult.findFirst({
            where: {
              assignmentId: assignId,
              studentId: student.id_student,
            },
            include: {
              assignment: {
                include: {
                  subject: {
                    include: { classe: true },
                  },
                },
              },
              student: true,
            },
          });
          if (assignRslt) {
            corrections.push(assignRslt);
          }
        }
      } else {
        // Admin or teacher - return all student results
        const results = await prisma.assignmentResult.findMany({
          where: {
            assignmentId: assignId,
            student: { classeId: classId },
          },
          include: {
            student: true,
            assignment: {
              include: {
                subject: {
                  include: { classe: true },
                },
              },
            },
          },
        });
        corrections.push(...results);
      }
    } else {
      // Create new assignment results for all students in class
      for (const student of classe.students) {
        const result = await prisma.assignmentResult.create({
          data: {
            assignmentId: assignId,
            studentId: student.id_student,
          },
          include: {
            assignment: {
              include: {
                subject: {
                  include: { classe: true },
                },
              },
            },
            student: true,
          },
        });
        corrections.push(result);
      }

      // Update assignment status
      await prisma.assignment.update({
        where: { id_assignment: assignId },
        data: { correction_status: "Launched" },
      });
    }

    res.status(201).json({
      message: "Correction launched successfully",
      corrections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get assignment results for a specific assignment
exports.getAssignmentResultsByAssignment = async (req, res) => {
  try {
    const asgId = parseInt(req.query.asgid, 10);

    if (Number.isNaN(asgId)) {
      return res.status(400).json({ error: "Invalid assignment id" });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id_assignment: asgId },
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const results = await prisma.assignmentResult.findMany({
      where: { assignmentId: asgId },
      include: { student: true },
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
