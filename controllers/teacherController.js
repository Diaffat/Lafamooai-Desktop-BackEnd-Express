const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require("../prisma");
const { serializeTeacher } = require("../serializers/teacherSerializer");

exports.getTeachers = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || pageLimit;

    const where = search
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
      : {};

    const totalTeachers = await prisma.teacher.count({ where });

    const teachers = await prisma.teacher.findMany({
      skip: (page - 1) * limit,
      take: limit,
      distinct: ["id_teacher"],
      where,
      include: {
        user: true,
        subjects: {
          include: {
            classe: {
              select: {
                id_class: true,
                name: true,
              },
            },
          },
        },
        supervisedClasses: true,
      },
    });

    // équivalent distinct() - maintenant géré par Prisma avec distinct: ['id_teacher']
    res.json({ count: totalTeachers, results: teachers.map(serializeTeacher) });
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
      return res.status(400).json({ error: "Invalid teacher id" });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id_teacher: id },
      include: {
        user: true,

        // Matières enseignées
        subjects: {
          include: {
            classe: true,
          },
        },

        // Classes dont il est superviseur
        supervisedClasses: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({
        error: "Teacher not found",
      });
    }

    // Classes dans lesquelles le professeur enseigne
    const classesMap = new Map();

    teacher.subjects.forEach((subject) => {
      if (subject.classe) {
        classesMap.set(
          subject.classe.id_class,
          subject.classe
        );
      }
    });

    // Classes enseignées
    const classes = Array.from(classesMap.values());

    return res.json({
      ...teacher,

      // Liste des classes
      classes,

      // Nombre de classes
      classesCount: classes.length,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Erreur de Serveur",
    });
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
        ...(userId && { userId: parseInt(userId, 10) }),
      },
      include: {
        user: true,
        subjects: true,
        supervisedClasses: true,
      },
    });

    res.status(201).json(teacher);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update teacher
exports.updateTeacher = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id, 10);

    if (Number.isNaN(teacherId)) {
      return res.status(400).json({
        error: "Invalid teacher id",
      });
    }

    const {
      username,
      email,
      firstName,
      lastName,
      phone,
      address,
      gender,
      birthday,
      hireDate,
      department,
      bio,
      img,
    } = req.body;

    const updatedTeacher = await prisma.$transaction(async (tx) => {
      // 1. Récupérer le teacher
      const teacher = await tx.teacher.findUnique({
        where: {
          id_teacher: teacherId,
        },
      });

      if (!teacher) {
        throw new Error("Teacher not found");
      }

      // 2. Mettre à jour CustomUser
      if (teacher.userId) {
        await tx.customUser.update({
          where: {
            id: teacher.userId,
          },
          data: {
            ...(username !== undefined && { username }),
            ...(email !== undefined && { email }),
            ...(firstName !== undefined && {
              first_name: firstName,
            }),
            ...(lastName !== undefined && {
              last_name: lastName,
            }),
            ...(phone !== undefined && {
              tel: phone,
            }),
            ...(address !== undefined && {
              address,
            }),
            ...(gender !== undefined && {
              gender,
            }),
            //...(img !== undefined && {
              //img,
            //}),
          },
        });
      }

      // 3. Mettre à jour Teacher
      const updated = await tx.teacher.update({
        where: {
          id_teacher: teacherId,
        },
        data: {
          ...(birthday !== undefined && {
            birth_date: birthday
              ? new Date(birthday)
              : null,
          }),

          ...(hireDate !== undefined && {
            hire_date: hireDate
              ? new Date(hireDate)
              : null,
          }),

          ...(department !== undefined && {
            department: department || null,
          }),

          ...(bio !== undefined && {
            bio: bio || null,
          }),
        },

        include: {
          user: true,

          subjects: {
            include: {
              classe: true,
            },
          },

          supervisedClasses: true,
        },
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      teacher: updatedTeacher,
    });

  } catch (err) {
    console.error("UPDATE TEACHER ERROR:", err);

    if (err.message === "Teacher not found") {
      return res.status(404).json({
        error: "Teacher not found",
      });
    }

    return res.status(500).json({
      error: err.message || "Server error",
    });
  }
};

// Delete teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid teacher id" });
    }

    await prisma.teacher.delete({
      where: { id_teacher: id },
    });

    res.json({ message: "Teacher deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
