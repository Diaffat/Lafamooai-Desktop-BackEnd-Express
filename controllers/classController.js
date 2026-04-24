const prisma = require('../prisma');

const pageLimit = parseInt(process.env.pageLimit, 10);

exports.getClasses = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const total = await prisma.class.count({ where });
    const classes = await prisma.class.findMany({
      where,
      include: {
        grade: true,
        supervisor: {
          include: {
            user: true,
          },
        },
        students: {
          include: {
            account: true,
          },
        },
        subjects: true,
      },
      orderBy: { id_class: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const results = classes.map((classe) => ({
      ...classe,
      grade: classe.gradeId ?? null,
      class_name: classe.name,
      effective: classe.students?.length ?? 0,
    }));

    res.json({ count: total, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getClassById = async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  if (Number.isNaN(classId)) {
    return res.status(400).json({ error: 'Invalid class id' });
  }

  try {
    const classe = await prisma.class.findUnique({
      where: { id_class: classId },
      include: {
        grade: true,
        supervisor: {
          include: {
            user: true,
          },
        },
        students: {
          include: {
            account: true,
          },
        },
        subjects: true,
      },
    });

    if (!classe) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({
      ...classe,
      grade: classe.gradeId ?? null,
      class_name: classe.name,
      effective: classe.students?.length ?? 0,
      subjects: classe.subjects ?? [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createClass = async (req, res) => {
  try {
    const { name, capacity, annee_academique, grade, supervisor } = req.body;
    const newClass = await prisma.class.create({
      data: {
        name,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        annee_academique,
        gradeId: grade ? parseInt(grade, 10) : undefined,
        supervisorId: supervisor ? parseInt(supervisor, 10) : undefined,
      },
    });

    res.status(201).json(newClass);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateClass = async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  if (Number.isNaN(classId)) {
    return res.status(400).json({ error: 'Invalid class id' });
  }

  try {
    const { name, capacity, annee_academique, grade, supervisor } = req.body;
    const updatedClass = await prisma.class.update({
      where: { id_class: classId },
      data: {
        name,
        capacity: capacity !== undefined ? parseInt(capacity, 10) : undefined,
        annee_academique,
        gradeId: grade ? parseInt(grade, 10) : undefined,
        supervisorId: supervisor ? parseInt(supervisor, 10) : undefined,
      },
    });

    res.json(updatedClass);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteClass = async (req, res) => {
  const classId = parseInt(req.params.id, 10);
  if (Number.isNaN(classId)) {
    return res.status(400).json({ error: 'Invalid class id' });
  }

  try {
    await prisma.class.delete({ where: { id_class: classId } });
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
