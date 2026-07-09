const prisma = require("../prisma");
const pageLimit = parseInt(process.env.pageLimit, 10);
const crypto = require("crypto");
const { registerEnrollment } = require("../services/enrollmentService");

const {
  buildEnrollmentStatusFilter,
  INSCRIBED_STATUSES,
} = require("../utils/enrollmentStatus");
const { createUserWithRole } = require("../services/authService");
const { sendAccountsEmail } = require("../services/emailService");
const { generateCNI } = require("../services/authService");
const { getParams } = require("../utils/monthlyFeeDetailsUtils");

const generateUsername = (base) => `${base}${crypto.randomInt(100, 999)}`;

const generatePassword = () => crypto.randomBytes(4).toString("hex");

const resolveDemandedClassLevelId = async (value, tx = prisma) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    return null;
  }

  const selectedClass = await tx.class.findUnique({
    where: { id_class: parsedValue },
    select: { gradeId: true },
  });

  if (selectedClass?.gradeId) {
    return selectedClass.gradeId;
  }

  const grade = await tx.grade.findUnique({
    where: { id_grade: parsedValue },
    select: { id_grade: true },
  });

  return grade?.id_grade ?? null;
};

const parseIntOrDefault = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const generateReceiptReference = async (code = "FIA") => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const unique = Date.now();
  return `${code}${date}${unique}`;
};

const getEnrollments = async (req, res) => {
  try {
    const statusParam = req.query.status;
    const search = (req.query.search || "").toString();
    const page = parseIntOrDefault(req.query.page, 1);
    const limit = parseIntOrDefault(req.query.limit, pageLimit);

    const where = buildEnrollmentStatusFilter(statusParam);

    if (search) {
      where.OR = [
        { tutor: { firstname: { contains: search, mode: "insensitive" } } },
        { tutor: { lastname: { contains: search, mode: "insensitive" } } },
        { tutor: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [count, enrollments] = await Promise.all([
      prisma.enrollement.count({ where }),
      prisma.enrollement.findMany({
        where,
        include: {
          tutor: true,
          students: {
            include: {
              demanded_class_level: true,
              class: {
                select: {
                 // id_class: true,
                  name: true,
                },
              },
              feeDetails: {
                include: {
                  receipt: true, // 🔥 ICI
                },
              },
              supporting_documents: true,
            },
          },
        },
        orderBy: { submission_date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({ count, results: enrollments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const getEnrollmentById = async (req, res) => {
  const enrollmentId = parseInt(req.params.id, 10);
  if (Number.isNaN(enrollmentId)) {
    return res.status(400).json({ error: "Invalid enrollment id" });
  }

  try {
    const enrollment = await prisma.enrollement.findUnique({
      where: { id_enrollement: enrollmentId },
      include: {
        tutor: true,
        students: {
          include: {
            demanded_class_level: true,
          },
        },
      },
    });

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    return res.json(enrollment);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const customCreate = async (req, res) => {
  try {
    const tutorData = req.body.tutor;
    const studentsData = req.body.students;
    const schoolYear = req.body.school_year || "2025-2026";

    if (
      !tutorData ||
      !Array.isArray(studentsData) ||
      studentsData.length === 0
    ) {
      return res.status(400).json({ error: "Missing tutor or students data" });
    }

    const tutor = await prisma.enrollement_tutor_info.create({
      data: {
        firstname: tutorData.firstname,
        lastname: tutorData.lastname,
        email: tutorData.email,
        tel: tutorData.tel,
        address: tutorData.address,
        gender: tutorData.gender || "Masculin",
        relationship: tutorData.relationship || "father",
      },
    });

    const enrollment = await prisma.enrollement.create({
      data: {
        tutorId: tutor.id_enrollement_tutor_info,
        school_year: schoolYear,
        submission_date: new Date(),
        status: "Accepted",
      },
    });

    const mappedStudentData = await Promise.all(
      studentsData.map(async (s) => ({
        enrollementId: enrollment.id_enrollement,
        firstname: s.firstname,
        lastname: s.lastname,
        gender: s.gender || "masculin",
        age: parseIntOrDefault(s.age, 0),
        classId: s.classId ? parseInt(s.classId, 10) : null,
        demanded_class_levelId: await resolveDemandedClassLevelId(
          s.classId,
        ),
      })),
    );

    await prisma.enrollement_student_info.createMany({
      data: mappedStudentData,
    });

    await registerEnrollment(enrollment.id_enrollement);

    const serialized = await prisma.enrollement.findUnique({
      where: { id_enrollement: enrollment.id_enrollement },
      include: {
        tutor: true,
        students: {
          include: {
            class: {
              select: { name: true },
            },
            demanded_class_level: true,
          },
        },
      },
    });

    return res
      .status(201)
      .json({ message: "Enrôlement réussi", data: serialized });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const customUpdate = async (req, res) => {
  const enrollmentId = parseInt(req.params.id, 10);
  if (Number.isNaN(enrollmentId)) {
    return res.status(400).json({ error: "Invalid enrollment id" });
  }

  try {
    const enrollment = await prisma.enrollement.findUnique({
      where: { id_enrollement: enrollmentId },
      include: { tutor: true },
    });

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    const tutorData = req.body.tutor;
    const studentsData = req.body.students;

    if (!tutorData || !Array.isArray(studentsData)) {
      return res.status(400).json({ error: "Missing tutor or students data" });
    }

    await prisma.enrollement_tutor_info.update({
      where: { id_enrollement_tutor_info: enrollment.tutorId },
      data: {
        firstname: tutorData.firstname,
        lastname: tutorData.lastname,
        email: tutorData.email,
        tel: tutorData.tel,
        address: tutorData.address,
        relationship: tutorData.relationship,
      },
    });

    for (const studentRecord of studentsData) {
      const resolvedDemandedClassLevelId = await resolveDemandedClassLevelId(
        studentRecord.classId,
      );

      const studentData = {
        firstname: studentRecord.firstname,
        lastname: studentRecord.lastname,
        gender: studentRecord.gender || "masculin",
        age: parseIntOrDefault(studentRecord.age, 0),
        classId: studentRecord.classId ? parseInt(studentRecord.classId, 10) : null,
        demanded_class_levelId: resolvedDemandedClassLevelId ?? null,
      };

      if (studentRecord.id_enrollement_student_info) {
        await prisma.enrollement_student_info.update({
          where: {
            id_enrollement_student_info: parseInt(
              studentRecord.id_enrollement_student_info,
              10,
            ),
          },
          data: studentData,
        });
      } else {
        await prisma.enrollement_student_info.create({
          data: {
            enrollementId: enrollment.id_enrollement,
            ...studentData,
          },
        });
      }
    }

    const updated = await prisma.enrollement.findUnique({
      where: { id_enrollement: enrollment.id_enrollement },
      include: {
        tutor: true,
        students: {
          include: { demanded_class_level: true },
        },
      },
    });

    return res
      .status(200)
      .json({ message: "Enrollement updated successfully", results: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const deleteEnrollment = async (req, res) => {
  const enrollmentId = parseInt(req.params.id, 10);
  if (Number.isNaN(enrollmentId)) {
    return res.status(400).json({ error: "Invalid enrollment id" });
  }

  try {
    await prisma.enrollement_student_info.deleteMany({
      where: { enrollementId: enrollmentId },
    });
    await prisma.enrollement.delete({
      where: { id_enrollement: enrollmentId },
    });

    return res.json({ message: "Enrollment deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const createAccountsForEnrollment = async (enrollementId, prismaClient) => {
  const db = prismaClient || prisma;
  const enrollementRecord = await db.enrollement.findUnique({
    where: { id_enrollement: enrollementId },
    include: {
      tutor: true,
      students: {
        include: {
          demanded_class_level: true,
        },
      },
    },
  });

  if (!enrollementRecord || !enrollementRecord.tutor) {
    throw new Error("Enrollment or tutor not found");
  }

  const tutorInfo = enrollementRecord.tutor;
  const parentUsername = generateUsername(tutorInfo.firstname);
  const parentPassword = generatePassword();

  const parentUser = await createUserWithRole({
    username: parentUsername,
    email: tutorInfo.email || `${parentUsername}@lafamooai.local`,
    password: parentPassword,
    role: "parent",
    tel: tutorInfo.tel,
    address: tutorInfo.address,
    gender: tutorInfo.gender,
    prismaClient: db,
  });

  const parent = await db.parent.findFirst({
    where: { userId: parentUser.id },
  });
  if (!parent) {
    throw new Error("Parent account creation failed");
  }

  const studentAccounts = [];
  for (const studentInfo of enrollementRecord.students) {
    const defaultClass = studentInfo.demanded_class_level
      ? await db.class.findFirst({
          where: {
            grade: { level: studentInfo.demanded_class_level.level },
          },
          orderBy: { id_class: "asc" },
          include: { grade: true },
        })
      : null;

    const accountAllowed =
      studentInfo.demanded_class_level &&
      studentInfo.demanded_class_level.level > 0;
    let studentUser = null;
    let accountCredentials = null;

    if (accountAllowed) {
      const studentUsername = generateUsername(studentInfo.firstname);
      const studentPassword = generatePassword();
      const studentEmail = `${studentUsername}@lafamooai.local`;

      studentUser = await createUserWithRole({
        username: studentUsername,
        email: studentEmail,
        password: studentPassword,
        role: "student",
        gender: studentInfo.gender,
        prismaClient: db,
      });

      accountCredentials = {
        username: studentUsername,
        password: studentPassword,
      };
    }

    const existingStudent = studentUser
      ? await db.student.findFirst({ where: { accountId: studentUser.id } })
      : null;

    const studentData = {
      parentId: parent.id_parent,
      first_name: studentInfo.firstname,
      last_name: studentInfo.lastname,
      CNI: studentInfo.cni || generateCNI(),
      gender: studentInfo.gender,
      classeId: defaultClass?.id_class,
    };

    if (studentUser) {
      studentData.accountId = studentUser.id;
    }

    const student = existingStudent
      ? await db.student.update({
          where: { id_student: existingStudent.id_student },
          data: studentData,
        })
      : await db.student.create({
          data: studentData,
        });

    if (!student) {
      throw new Error("student account creation failed");
    }

    studentAccounts.push({
      student,
      studentInfo,
      credentials: accountCredentials,
    });
  }

  return { parent: parentUser, students: studentAccounts };
};

const accept = async (req, res) => {
  const enrollmentId = parseInt(req.params.id, 10);
  if (Number.isNaN(enrollmentId)) {
    return res.status(400).json({ error: "Invalid enrollment id" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollement.findUnique({
        where: { id_enrollement: enrollmentId },
        include: {
          tutor: true,
          students: {
            include: {
              demanded_class_level: true,
            },
          },
        },
      });

      if (!enrollment) {
        throw new Error("Enrollment not found");
      }

      // 🔥 création comptes
      const createdAccounts = await createAccountsForEnrollment(
        enrollmentId,
        tx,
      );

      if (!createdAccounts.students || !createdAccounts.parent) {
        throw new Error("Accounts creation failed");
      }

      // 🔥 CRÉATION RECEIPTS (comme Django)
      for (const { student, studentInfo } of createdAccounts.students) {
        if (!student?.classeId) {
          continue;
        }

        const classe = await tx.class.findUnique({
          where: { id_class: student.classeId },
          include: { grade: true },
        });

        const enrolFee = classe?.grade?.enrollement_fee;
        if (!enrolFee) {
          continue;
        }

        const receipt = await tx.receipt.create({
          data: {
            reference: await generateReceiptReference("FIA"),
            total_amount: enrolFee,
            school_years: enrollment.school_year,
          },
        });

        await tx.enrollementFeeDetails.create({
          data: {
            studentId: student.id_student,
            student_enrol_infoId: studentInfo.id_enrollement_student_info,
            receiptId: receipt.id_receipt,
            school_years: enrollment.school_year,
          },
        });

        // 🔥 12 mois
        for (let m = 1; m <= 12; m++) {
          await tx.monthlyFeeDetails.create({
            data: {
              month: String(m),
              studentId: student.id_student,
              classeId: student.classeId,
              school_years: enrollment.school_year,
            },
          });
        }
      }

      // 🔥 update status
      await tx.enrollement.update({
        where: { id_enrollement: enrollmentId },
        data: { status: "Accepted" },
      });

      return {
        tutorEmail: enrollment.tutor?.email,
        createdAccounts,
      };
    });

    await sendAccountsEmail(result.tutorEmail, result.createdAccounts);

    return res.json({
      message: "Enrôlement accepté.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const inscribedWhere = {
      enrollement: { status: { in: INSCRIBED_STATUSES } },
    };
    const params = await getParams();
    const school_year = params.school_years;

    const demandes = await prisma.enrollement_student_info.count({
      where: { enrollement: { status: { not: "Accepted" } } },
    });

    const enrolled = await prisma.enrollement_student_info.count({
      where: inscribedWhere,
    });

    const enrolled_boys = await prisma.enrollement_student_info.count({
      where: { ...inscribedWhere, gender: "male" },
    });

    const enrolled_girls = await prisma.enrollement_student_info.count({
      where: { ...inscribedWhere, gender: "female" },
    });

    const students = await prisma.enrollement_student_info.findMany({
      where: {
        ...inscribedWhere,
        classId: { not: null },
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
    });

    const grade_stats = {};

    students.forEach((student) => {
      const className = student.class?.name ?? "Sans classe";

      grade_stats[className] = (grade_stats[className] || 0) + 1;
    });

    const acceptedStudents = await prisma.enrollement_student_info.findMany({
      where: inscribedWhere,
      include: { enrollement: true },
    });

    const growthMap = acceptedStudents.reduce((acc, student) => {
      const date =
        student.enrollement?.submission_date?.toISOString().slice(0, 10) ??
        "unknown";
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const growth = Object.entries(growthMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    
    const totalEnrolmentFees = await prisma.receipt.aggregate({
      where: {
        feeDetails: {
          some: {},
        },
      },
      _sum: {
        total_amount: true,
      },
    });
    const totalFees = totalEnrolmentFees._sum.total_amount ?? 0;

    return res.json({
      demandes,
      school_year,
      enrolled,
      enrolled_boys,
      enrolled_girls,

      grade_stats,
      growth,
      totalFees,
      total_classes: Object.keys(grade_stats).length

    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getEnrollments,
  getEnrollmentById,
  customCreate,
  customUpdate,
  deleteEnrollment,
  accept,
  getStats,
  generatePassword,
  generateUsername,
};
