const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

exports.getGrades = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const where = {};
    if (search) {
      const level = parseInt(search, 10);
      if (!Number.isNaN(level)) {
        where.level = level;
      }
    }

    const total = await prisma.grade.count({ where });
    const grades = await prisma.grade.findMany({
      where,
      orderBy: { id_grade: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ count: total, results: grades });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getGradeById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid grade id' });
  }

  try {
    const grade = await prisma.grade.findUnique({
      where: { id_grade: id },
    });

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    res.json(grade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createGrade = async (req, res) => {
  try {
    const { level, enrollement_fee, monthly_fee } = req.body;
    const grade = await prisma.grade.create({
      data: {
        level: parseInt(level, 10),
        enrollement_fee: enrollement_fee ? parseInt(enrollement_fee, 10) : undefined,
        monthly_fee: monthly_fee ? parseInt(monthly_fee, 10) : undefined,
      },
    });

    res.status(201).json(grade);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Grade level must be unique' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateGrade = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid grade id' });
  }

  try {
    const { level, enrollement_fee, monthly_fee } = req.body;
    const updatedGrade = await prisma.grade.update({
      where: { id_grade: id },
      data: {
        level: level !== undefined ? parseInt(level, 10) : undefined,
        enrollement_fee: enrollement_fee !== undefined ? parseInt(enrollement_fee, 10) : undefined,
        monthly_fee: monthly_fee !== undefined ? parseInt(monthly_fee, 10) : undefined,
      },
    });

    res.json(updatedGrade);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Grade not found' });
    }
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Grade level must be unique' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteGrade = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid grade id' });
  }

  try {
    await prisma.grade.delete({ where: { id_grade: id } });
    res.json({ message: 'Grade deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Grade not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
