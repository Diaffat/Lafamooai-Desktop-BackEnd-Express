const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

exports.getMonthlyFeeParams = async (req, res) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const total = await prisma.monthlyFeeParams.count({ where });
    const params = await prisma.monthlyFeeParams.findMany({
      where,
      orderBy: { id_mthl_fp: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ count: total, results: params });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMonthlyFeeParamById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee params id' });
  }

  try {
    const monthlyFeeParam = await prisma.monthlyFeeParams.findUnique({
      where: { id_mthl_fp: id },
    });

    if (!monthlyFeeParam) {
      return res.status(404).json({ error: 'Monthly fee params not found' });
    }

    res.json(monthlyFeeParam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createMonthlyFeeParam = async (req, res) => {
  try {
    const {
      name,
      unit_price,
      start_month,
      end_month,
      deadline,
      start_year,
      school_years,
    } = req.body;

    const monthlyFeeParam = await prisma.monthlyFeeParams.create({
      data: {
        name,
        unit_price: unit_price !== undefined ? parseInt(unit_price, 10) : undefined,
        start_month: start_month !== undefined ? parseInt(start_month, 10) : undefined,
        end_month: end_month !== undefined ? parseInt(end_month, 10) : undefined,
        deadline: deadline !== undefined ? parseInt(deadline, 10) : undefined,
        start_year: start_year !== undefined ? parseInt(start_year, 10) : undefined,
        school_years,
      },
    });

    res.status(201).json(monthlyFeeParam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateMonthlyFeeParam = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee params id' });
  }

  try {
    const {
      name,
      unit_price,
      start_month,
      end_month,
      deadline,
      start_year,
      school_years,
    } = req.body;

    const updatedMonthlyFeeParam = await prisma.monthlyFeeParams.update({
      where: { id_mthl_fp: id },
      data: {
        name,
        unit_price: unit_price !== undefined ? parseInt(unit_price, 10) : undefined,
        start_month: start_month !== undefined ? parseInt(start_month, 10) : undefined,
        end_month: end_month !== undefined ? parseInt(end_month, 10) : undefined,
        deadline: deadline !== undefined ? parseInt(deadline, 10) : undefined,
        start_year: start_year !== undefined ? parseInt(start_year, 10) : undefined,
        school_years,
      },
    });

    res.json(updatedMonthlyFeeParam);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Monthly fee params not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteMonthlyFeeParam = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee params id' });
  }

  try {
    await prisma.monthlyFeeParams.delete({ where: { id_mthl_fp: id } });
    res.json({ message: 'Monthly fee params deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Monthly fee params not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
