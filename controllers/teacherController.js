const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require("../prisma");
const { serializeTeacher } = require("../serializers/teacherSerializer");

exports.getTeachers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || pageLimit;

    const teachers = await prisma.teacher.findMany({
      skip: (page - 1) * limit,
      take: limit,
      distinct: ['id_teacher'],
      where: search
        ? {
            OR: [
              // Recherche dans les champs de CustomUser via la relation
              {
                user: {
                  username: { contains: search, mode: "insensitive" },
                },
              },
              {
                user: {
                  email: { contains: search, mode: "insensitive" },
                },
              },
              {
                user: {
                  tel: { contains: search, mode: "insensitive" },
                },
              },
              {
                user: {
                  address: { contains: search, mode: "insensitive" },
                },
              },
              // relations
              {
                subjects: {
                  some: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              },
              {
                supervisedClasses: {
                  some: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {},

      include: {
        user: true,
        subjects: true,
        supervisedClasses: true,
      },
    });

    // équivalent distinct() - maintenant géré par Prisma avec distinct: ['id_teacher']
    res.json({ count: teachers.length, results: teachers.map(serializeTeacher) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get teacher by ID
exports.getTeacherById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id_teacher: id },
      include: {
        user: true,
        subjects: { include: { classe: true } },
        supervisedClasses: true,
      }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json(teacher);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create teacher
exports.createTeacher = async (req, res) => {
  try {
    const { username, email, tel, address, userId } = req.body;

    const teacher = await prisma.teacher.create({
      data: {
        username,
        email,
        tel,
        address,
        ...(userId && { userId: parseInt(userId, 10) })
      },
      include: {
        user: true,
        subjects: true,
        supervisedClasses: true
      }
    });

    res.status(201).json(teacher);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update teacher
exports.updateTeacher = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }

    const { username, email, tel, address } = req.body;

    const teacher = await prisma.teacher.update({
      where: { id_teacher: id },
      data: {
        ...(username && { username }),
        ...(email && { email }),
        ...(tel && { tel }),
        ...(address && { address })
      },
      include: {
        user: true,
        subjects: true,
        supervisedClasses: true
      }
    });

    res.json(teacher);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }

    await prisma.teacher.delete({
      where: { id_teacher: id }
    });

    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};