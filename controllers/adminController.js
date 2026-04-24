const prisma = require("../prisma");
const { serializeAdmin } = require("../serializers/adminSerializer");

const pageLimit = parseInt(process.env.pageLimit, 10);

exports.getAdmins = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const where = search
      ? {
          user: {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
              { tel: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {};

    const [admins, total] = await Promise.all([
      prisma.admin.findMany({
        where,
        include: { user: true },
        orderBy: { id_admin: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.admin.count({ where }),
    ]);

    res.json({
      count: total,
      results: admins.map(serializeAdmin),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAdminById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid admin id" });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { id_admin: id },
      include: { user: true },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json(serializeAdmin(admin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createAdmin = async (req, res) => {
  const { userId } = req.body;
  const parsedUserId = parseInt(userId, 10);

  if (Number.isNaN(parsedUserId)) {
    return res.status(400).json({ error: "Valid userId is required" });
  }

  try {
    const existing = await prisma.admin.findFirst({
      where: { userId: parsedUserId },
    });

    if (existing) {
      return res.status(409).json({ error: "Admin already exists for this user" });
    }

    const admin = await prisma.admin.create({
      data: {
        user: { connect: { id: parsedUserId } },
      },
      include: { user: true },
    });

    res.status(201).json(serializeAdmin(admin));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateAdmin = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { userId } = req.body;

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid admin id" });
  }

  const data = {};

  if (userId !== undefined) {
    const parsedUserId = parseInt(userId, 10);
    if (Number.isNaN(parsedUserId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    data.user = { connect: { id: parsedUserId } };
  }

  try {
    const admin = await prisma.admin.update({
      where: { id_admin: id },
      data,
      include: { user: true },
    });

    res.json(serializeAdmin(admin));
  } catch (err) {
    console.error(err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteAdmin = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid admin id" });
  }

  try {
    await prisma.admin.delete({
      where: { id_admin: id },
    });

    res.json({ message: "Admin deleted successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};
