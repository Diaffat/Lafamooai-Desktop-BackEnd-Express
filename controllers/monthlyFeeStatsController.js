const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

const buildWhereClause = (search) => {
  const where = {};

  if (search) {
    const clauses = [
      { school_years: { contains: search, mode: 'insensitive' } },
      { classe: { name: { contains: search, mode: 'insensitive' } } },
    ];

    const parsedValue = parseInt(search, 10);
    if (!Number.isNaN(parsedValue)) {
      clauses.push({ month: { equals: parsedValue } });
      clauses.push({ total_collected: { equals: parsedValue } });
    }

    if (clauses.length) {
      where.OR = clauses;
    }
  }

  return where;
};

exports.getMonthlyFeeStats = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;
    const offset = (page - 1) * limit;

    const where = buildWhereClause(search);

    const total = await prisma.monthlyFeeStats.count({ where });
    const results = await prisma.monthlyFeeStats.findMany({
      where,
      include: { classe: true },
      orderBy: { id_mthl_fs: 'asc' },
      skip: offset,
      take: limit,
    });

    return res.json({ count: total, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getMonthlyFeeStatById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee stats id' });
  }

  try {
    const monthlyFeeStat = await prisma.monthlyFeeStats.findUnique({
      where: { id_mthl_fs: id },
      include: { classe: true },
    });

    if (!monthlyFeeStat) {
      return res.status(404).json({ error: 'Monthly fee stats not found' });
    }

    return res.json(monthlyFeeStat);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.createMonthlyFeeStat = async (req, res) => {
  try {
    const { month, classeId, total_collected, school_years } = req.body;

    const monthlyFeeStat = await prisma.monthlyFeeStats.create({
      data: {
        month: month !== undefined ? parseInt(month, 10) : undefined,
        total_collected: total_collected !== undefined ? parseInt(total_collected, 10) : undefined,
        school_years,
        classe: classeId ? { connect: { id_class: parseInt(classeId, 10) } } : undefined,
      },
    });

    return res.status(201).json(monthlyFeeStat);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.updateMonthlyFeeStat = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee stats id' });
  }

  try {
    const { month, classeId, total_collected, school_years } = req.body;

    const monthlyFeeStat = await prisma.monthlyFeeStats.update({
      where: { id_mthl_fs: id },
      data: {
        month: month !== undefined ? parseInt(month, 10) : undefined,
        total_collected: total_collected !== undefined ? parseInt(total_collected, 10) : undefined,
        school_years,
        classe: classeId !== undefined
          ? { connect: { id_class: parseInt(classeId, 10) } }
          : undefined,
      },
    });

    return res.json(monthlyFeeStat);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Monthly fee stats not found' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteMonthlyFeeStat = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee stats id' });
  }

  try {
    await prisma.monthlyFeeStats.delete({ where: { id_mthl_fs: id } });
    return res.json({ message: 'Monthly fee stats deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Monthly fee stats not found' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};
