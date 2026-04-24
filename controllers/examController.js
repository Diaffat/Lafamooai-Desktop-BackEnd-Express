const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

// Get all exams with filtering and pagination
exports.getExams = async (req, res) => {
  try {
    const { search, classId } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const user = req.user; // From auth middleware

    const where = {};

    // Search filter
    if (search) {
      where.title = { contains: search };
    }

    // Class filter
    if (classId && classId !== 'NaN' && classId !== '') {
      const parsedClassId = parseInt(classId, 10);
      if (!Number.isNaN(parsedClassId)) {
        where.classes = {
          some: { 
            id_class: parsedClassId
          }
        };
      }
    }

    // Role-based filtering
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id }
      });
      if (teacher) {
        where.classes = {
          some: {
            subjects: {
              some: { teacherId: teacher.id_teacher }
            }
          }
        };
      }
    } else if (user.role === 'student') {
      const student = await prisma.student.findFirst({
        where: { accountId: user.id }
      });
      if (student) {
        where.classes = {
          some: { students: { some: { id_student: student.id_student } } }
        };
      }
    } else if (user.role === 'parent') {
      const students = await prisma.student.findMany({
        where: { parent: { user: { id: user.id } } }
      });
      if (students.length > 0) {
        const studentIds = students.map(s => s.id_student);
        where.classes = {
          some: { students: { some: { id_student: { in: studentIds } } } }
        };
      } else {
        where.id_exam = { in: [] }; // No results for parent with no students
      }
    }

    const total = await prisma.exam.count({ where });
    const exams = await prisma.exam.findMany({
      where,
      include: { classes: true },
      orderBy: { start_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({ count: total, results: exams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get exam by ID
exports.getExamById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const exam = await prisma.exam.findUnique({
      where: { id_exam: id },
      include: { classes: true }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create exam
exports.createExam = async (req, res) => {
  try {
    const { title, start_date, end_date, exam_type, school_years, status } = req.body;

    const exam = await prisma.exam.create({
      data: {
        title,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        exam_type,
        school_years,
        status: status || 'coming'
      },
      include: { classes: true }
    });

    res.status(201).json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update exam
exports.updateExam = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const { title, start_date, end_date, exam_type, school_years, status } = req.body;

    const exam = await prisma.exam.update({
      where: { id_exam: id },
      data: {
        ...(title && { title }),
        ...(start_date && { start_date: new Date(start_date) }),
        ...(end_date && { end_date: new Date(end_date) }),
        ...(exam_type && { exam_type }),
        ...(school_years && { school_years }),
        ...(status && { status })
      },
      include: { classes: true }
    });

    res.json(exam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete exam
exports.deleteExam = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    await prisma.exam.delete({
      where: { id_exam: id }
    });

    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get assignments for an exam
exports.getExamAssignments = async (req, res) => {
  try {
    const examId = parseInt(req.params.id, 10);
    if (Number.isNaN(examId)) {
      return res.status(400).json({ error: 'Invalid exam id' });
    }

    const exam = await prisma.exam.findUnique({
      where: { id_exam: examId },
      include: { classes: true }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const classeAssignments = [];

    for (const cls of exam.classes) {
      const oneClasseAssign = {
        classe_name: cls.name,
        assignments: [],
        all_assign: 0,
        waiting_assign: 0,
        waiting_assign_per: 0,
        launched_assign: 0,
        launched_assign_per: 0,
        corrected_assign: 0,
        corrected_assign_per: 0
      };

      const allAssign = await prisma.assignment.findMany({
        where: {
          examId,
          subject: { classeId: cls.id_class },
          asg_type: 'Primary_Note'
        },
        include: { subject: true }
      });

      if (allAssign.length > 0) {
        oneClasseAssign.assignments = allAssign;
        oneClasseAssign.all_assign = allAssign.length;

        const waitingAssignNum = await prisma.assignment.count({
          where: {
            examId,
            subject: { classeId: cls.id_class },
            correction_status: 'Waiting',
            asg_type: 'Primary_Note'
          }
        });
        oneClasseAssign.waiting_assign = waitingAssignNum;
        oneClasseAssign.waiting_assign_per = Math.round((waitingAssignNum / allAssign.length) * 100) / 100;

        const launchedAssignNum = await prisma.assignment.count({
          where: {
            examId,
            subject: { classeId: cls.id_class },
            correction_status: 'Launched',
            asg_type: 'Primary_Note'
          }
        });
        oneClasseAssign.launched_assign = launchedAssignNum;
        oneClasseAssign.launched_assign_per = Math.round((launchedAssignNum / allAssign.length) * 100) / 100;

        const correctedAssignNum = await prisma.assignment.count({
          where: {
            examId,
            subject: { classeId: cls.id_class },
            correction_status: 'Corrected',
            asg_type: 'Primary_Note'
          }
        });
        oneClasseAssign.corrected_assign = correctedAssignNum;
        oneClasseAssign.corrected_assign_per = Math.round((correctedAssignNum / allAssign.length) * 100) / 100;
      }

      classeAssignments.push(oneClasseAssign);
    }

    res.json(classeAssignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
