const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

const getStudentForUser = async (user) => {
  if (!user) return null;
  return prisma.student.findFirst({ where: { accountId: user.userId } });
};

const getParentStudentIds = async (user) => {
  if (!user) return [];
  const parent = await prisma.parent.findFirst({ where: { userId: user.userId } });
  if (!parent) return [];
  const students = await prisma.student.findMany({ where: { parentId: parent.id_parent }, select: { id_student: true } });
  return students.map((student) => student.id_student);
};

exports.getEnrollementFeeDetails = async (req, res) => {
  const user = req.user;
  const search = req.query.search || '';
  const page = parseInt(req.query.page, pageLimit) || 1;
  const limit = parseInt(req.query.limit, pageLimit) || pageLimit;
  const offset = (page - 1) * limit;

  const where = {};

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  if (user.role === 'admin') {
    // no extra filter
  } else if (user.role === 'student') {
    const student = await getStudentForUser(user);
    if (student) {
      where.studentId = student.id_student;
    } else {
      where.id_enrol_fdls = -1;
    }
  } else if (user.role === 'parent') {
    const studentIds = await getParentStudentIds(user);
    if (studentIds.length > 0) {
      where.studentId = { in: studentIds };
    } else {
      where.id_enrol_fdls = -1;
    }
  } else {
    where.id_enrol_fdls = -1;
  }

  try {
    const total = await prisma.enrollementFeeDetails.count({ where });
    const results = await prisma.enrollementFeeDetails.findMany({
      where,
      include: {
        student: {
          include: {
            account: true,
            classe: true,
            parent: true,
          },
        },
        student_enrol_info: true,
        receipt: true,
      },
      orderBy: { id_enrol_fdls: 'asc' },
      skip: offset,
      take: limit,
    });

    return res.json({ count: total, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getEnrollementFeeDetailById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid enrollement fee detail id' });
  }

  try {
    const detail = await prisma.enrollementFeeDetails.findUnique({
      where: { id_enrol_fdls: id },
      include: {
        student: { include: { account: true, classe: true, parent: true } },
        student_enrol_info: true,
        receipt: true,
      },
    });

    if (!detail) {
      return res.status(404).json({ error: 'Enrollement fee detail not found' });
    }

    return res.json(detail);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.createEnrollementFeeDetail = async (req, res) => {
  try {
    const { name, studentId, student_enrol_infoId, receiptId, school_years } = req.body;

    const created = await prisma.enrollementFeeDetails.create({
      data: {
        name,
        studentId: studentId !== undefined ? parseInt(studentId, 10) : undefined,
        student_enrol_infoId: student_enrol_infoId !== undefined ? parseInt(student_enrol_infoId, 10) : undefined,
        receiptId: receiptId !== undefined ? parseInt(receiptId, 10) : undefined,
        school_years,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.updateEnrollementFeeDetail = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid enrollement fee detail id' });
  }

  try {
    const { name, studentId, student_enrol_infoId, receiptId, school_years } = req.body;

    const updated = await prisma.enrollementFeeDetails.update({
      where: { id_enrol_fdls: id },
      data: {
        name,
        studentId: studentId !== undefined ? parseInt(studentId, 10) : undefined,
        student_enrol_infoId: student_enrol_infoId !== undefined ? parseInt(student_enrol_infoId, 10) : undefined,
        receiptId: receiptId !== undefined ? parseInt(receiptId, 10) : undefined,
        school_years,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollement fee detail not found' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteEnrollementFeeDetail = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid enrollement fee detail id' });
  }

  try {
    await prisma.enrollementFeeDetails.delete({ where: { id_enrol_fdls: id } });
    return res.json({ message: 'Enrollement fee detail deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollement fee detail not found' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.addNewEnrol = async (req, res) => {
  const assign_id = req.body.assign_id;
  const class_id = req.body.class_id;

  // Migration placeholder: Django action is declared but its body is not available in the snippet.
  // This preserves the endpoint shape while deferring business logic implementation.
  return res.status(501).json({
    message: 'add_new_enrol endpoint not implemented yet',
    assign_id,
    class_id,
  });
};
