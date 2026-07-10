// controllers/parent.controller.js
const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require("../prisma");
const { serializeParent } = require("../serializers/parentSerializer");

exports.getParents = async (req, res) => {
  try {
    const { search } = req.query;

    const where = {};

    if (search) {
      where.user = {
        OR: [
          { username: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { tel: { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || pageLimit;

    const [parents, total] = await Promise.all([
      prisma.parent.findMany({
        where,
        include: {
          user: true,
          children: {
            include: {
              account: true,
            },
          },
        },
        orderBy: {
          id_parent: "asc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.parent.count({ where }),
    ]);

    res.json({ count: total, results: parents.map(serializeParent) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getParentById = async (req, res) => {
  const { id } = req.params;
  const parentId = parseInt(id, 10);

  if (Number.isNaN(parentId)) {
    return res.status(400).json({ error: "Invalid parent id" });
  }

  try {
    const parent = await prisma.parent.findUnique({
      where: { id_parent: parentId },
      include: {
        user: true,
        children: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({ error: "Parent not found" });
    }

    res.json(serializeParent(parent));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
