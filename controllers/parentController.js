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
            classe: {
              select: {
                id_class: true,
                name: true,
              },
            },
            attendances: true,
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

exports.updateParent = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        error: "Invalid parent id",
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      gender,
    } = req.body;

    // 1. Vérifier que le parent existe
    const parent = await prisma.parent.findUnique({
      where: {
        id_parent: id,
      },
    });

    if (!parent) {
      return res.status(404).json({
        error: "Parent not found",
      });
    }

    // 2. Transaction
    const updatedParent = await prisma.$transaction(async (tx) => {

      // 3. Mettre à jour le CustomUser
      if (parent.userId) {
        await tx.customUser.update({
          where: {
            id: parent.userId,
          },
          data: {
            ...(firstName !== undefined && {
              first_name: firstName,
            }),

            ...(lastName !== undefined && {
              last_name: lastName,
            }),

            ...(email !== undefined && {
              email: email,
            }),

            ...(phone !== undefined && {
              tel: phone,
            }),

            ...(address !== undefined && {
              address: address,
            }),

            ...(gender !== undefined && {
              gender: gender,
            }),
          },
        });
      }

      // 4. Récupérer le parent avec ses données
      return await tx.parent.findUnique({
        where: {
          id_parent: id,
        },
        include: {
          user: true,
          children: true,
        },
      });
    });

    // 5. Réponse
    return res.json(updatedParent);

  } catch (err) {
    console.error("Erreur updateParent:", err);

    return res.status(500).json({
      error: "Erreur de serveur",
    });
  }
};