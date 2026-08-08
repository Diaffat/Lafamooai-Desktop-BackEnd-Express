// controllers/student.controller.js
const prisma = require("../prisma");
const { serializeStudent } = require("../serializers/studentSerializer");
const pageLimit = parseInt(process.env.pageLimit, 10);

exports.getStudents = async (req, res) => {
  try {
    const { search, gender } = req.query;

    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const where = {};

    if (search) {
      where.OR = [
        {
          account: {
            is: {
              username: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          account: {
            is: {
              email: { contains: search, mode: "insensitive"},
            },
          },
        },
        {
          account: {
            is: {
              tel: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          account: {
            is: {
              address: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          first_name: { contains: search, mode: "insensitive" },
        },
        {
          last_name: { contains: search, mode: "insensitive" },
        },
      ];
    }

    if (gender) {
      where.gender = gender;
    }
    
    const [count, students] = await Promise.all([
      prisma.student.count({ where }),   // 🔥 TOTAL RÉEL
      prisma.student.findMany({
        where,
        include: {
          account: true,
          parent: {
            include: { user: true },
          },
          classe: true,
        },
        orderBy: {
          id_student: "asc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      count: count,          // 🔥 total en DB
      results: students.map(serializeStudent),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getStudentById = async (req, res) => {
  const { id } = req.params;
  const studentId = parseInt(id, 10);

  if (Number.isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student id" });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id_student: studentId },
      include: {
        account: true,
        parent: {
          include: {
            user: true,
          },
        },
        classe: true,
      },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(serializeStudent(student));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateStudent = async (req, res) => {
  const studentId = parseInt(req.params.id, 10);

  if (isNaN(studentId)) {
    return res.status(400).json({
      error: "Invalid student id",
    });
  }

  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      birthday,
      bloodType,
      gender,
      classId,
      img,
    } = req.body;

    const updatedStudent = await prisma.$transaction(async (tx) => {
      // =========================
      // 1. Vérifier l'étudiant
      // =========================
      const student = await tx.student.findUnique({
        where: {
          id_student: studentId,
        },
        include: {
          account: true,
        },
      });

      if (!student) {
        throw new Error("Student not found");
      }

      // =========================
      // 2. Mettre à jour le compte
      // =========================
      if (student.accountId) {
        await tx.customUser.update({
          where: {
            id: student.accountId,
          },
          data: {
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { tel: phone }),
            ...(address !== undefined && { address }),
            ...(gender !== undefined && { gender }),
            ...(img !== undefined && { img }),
            ...(firstName !== undefined && { first_name: firstName }),
            ...(lastName !== undefined && { last_name: lastName }),
          },
        });
      }

      // =========================
      // 3. Mettre à jour Student
      // =========================
      const updated = await tx.student.update({
        where: {
          id_student: studentId,
        },
        data: {
          first_name: firstName,
          last_name: lastName,

          birth_date: birthday
            ? new Date(birthday)
            : null,

          // ⚠️ Prisma utilise blood_type
          blood_type: bloodType || null,

          gender: gender,

          classeId: classId
            ? Number(classId)
            : null,
        },

        include: {
          account: true,

          parent: {
            include: {
              user: true,
            },
          },

          classe: true,
        },
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student: serializeStudent(updatedStudent),
    });

  } catch (err) {
    console.error("UPDATE STUDENT ERROR:", err);

    return res.status(500).json({
      error: err.message || "Server error",
    });
  }
};

exports.deleteStudent = async (req, res) => {
  const studentId = parseInt(req.params.id, 10);

  if (Number.isNaN(studentId)) {
    return res.status(400).json({
      error: "Invalid student id",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // =========================
      // 1. Vérifier l'étudiant
      // =========================
      const student = await tx.student.findUnique({
        where: {
          id_student: studentId,
        },
        include: {
          account: true,
          parent: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!student) {
        const error = new Error("Student not found");
        error.statusCode = 404;
        throw error;
      }

      // Garder les IDs avant suppression
      const accountId = student.accountId;
      const parentId = student.parentId;
      const parentUserId = student.parent?.userId;

      // =========================
      // 2. Supprimer les données
      //    dépendantes de Student
      // =========================

      await tx.attendance.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      await tx.monthlyFeeDetails.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      await tx.enrollementFeeDetails.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      await tx.examResultDetails.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      await tx.examResult.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      await tx.assignmentResult.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      await tx.assignmentSubmission.deleteMany({
        where: {
          studentId: studentId,
        },
      });

      // =========================
      // 3. Supprimer le lien
      //    inscription → étudiant
      // =========================

      await tx.enrollement_student_info.updateMany({
        where: {
          studentId: studentId,
        },
        data: {
          studentId: null,
        },
      });

      // =========================
      // 4. Supprimer Student
      // =========================

      await tx.student.delete({
        where: {
          id_student: studentId,
        },
      });

      // =========================
      // 5. Supprimer le compte
      //    de l'étudiant
      // =========================

      if (accountId) {
        await tx.customUser.delete({
          where: {
            id: accountId,
          },
        });
      }

      // =========================
      // 6. Supprimer le parent
      //    SEULEMENT s'il n'a
      //    plus aucun enfant
      // =========================

      if (parentId) {
        const remainingStudents = await tx.student.count({
          where: {
            parentId: parentId,
          },
        });

        if (remainingStudents === 0) {
          await tx.parent.delete({
            where: {
              id_parent: parentId,
            },
          });

          if (parentUserId) {
            await tx.customUser.delete({
              where: {
                id: parentUserId,
              },
            });
          }
        }
      }

      return student;
    });

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
      studentId: result.id_student,
    });
  } catch (err) {
    console.error("DELETE STUDENT ERROR:", err);

    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
      error: err.message || "Server error",
    });
  }
};