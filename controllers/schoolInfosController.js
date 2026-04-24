const prisma = require('../prisma');
const pageLimit = parseInt(process.env.pageLimit, 10);

exports.getSchoolInfos = async (req, res) => {
  try {
    const { search, date } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (date) {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        const nextDay = new Date(parsed);
        nextDay.setDate(parsed.getDate() + 1);
        where.created_at = { gte: parsed, lt: nextDay };
      }
    }

    const total = await prisma.schoolInfos.count({ where });
    const schoolInfos = await prisma.schoolInfos.findMany({
      where,
      orderBy: { id_school: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ count: total, results: schoolInfos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSchoolInfoById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid school info id' });
  }

  try {
    const schoolInfo = await prisma.schoolInfos.findUnique({
      where: { id_school: id },
    });

    if (!schoolInfo) {
      return res.status(404).json({ error: 'School info not found' });
    }

    res.json(schoolInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createSchoolInfo = async (req, res) => {
  try {
    const { name, address, email, phone, logo, site } = req.body;
    const schoolInfo = await prisma.schoolInfos.create({
      data: {
        name,
        address,
        email,
        phone,
        logo,
        site,
      },
    });

    res.status(201).json(schoolInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateSchoolInfo = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid school info id' });
  }

  try {
    const { name, address, email, phone, logo, site } = req.body;
    const updatedSchoolInfo = await prisma.schoolInfos.update({
      where: { id_school: id },
      data: {
        name,
        address,
        email,
        phone,
        logo,
        site,
      },
    });

    res.json(updatedSchoolInfo);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'School info not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteSchoolInfo = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid school info id' });
  }

  try {
    await prisma.schoolInfos.delete({ where: { id_school: id } });
    res.json({ message: 'School info deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'School info not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
