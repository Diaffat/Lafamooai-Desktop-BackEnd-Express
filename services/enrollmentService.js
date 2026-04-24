const prisma = require("../prisma");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

// utils
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// mail config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// generate receipt ref
const generateReceiptReference = async (tx, code = "FIA") => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await tx.receipt.count();
  return `${code}${dateStr}${count + 1}`;
};

// MAIN SERVICE
const acceptEnrollmentService = async (enrollementId) => {
  return await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollement.findUnique({
      where: { id_enrollement: enrollementId },
      include: {
        tutor: true,
        students: {
          include: { demanded_class_level: true },
        },
      },
    });

    if (!enrollment) throw new Error("Enrollment not found");

    const tutor = enrollment.tutor;

    // 👤 CREATE PARENT
    const parentUsername = `${tutor.lastname}${randomInt(100, 999)}`;
    const parentPassword = `${randomInt(1000, 9999)}`;
    const hashedParentPassword = await bcrypt.hash(parentPassword, 10);

    const parentUser = await tx.user.create({
      data: {
        username: parentUsername,
        email: tutor.email || `${parentUsername}@lafamooai.local`,
        password: hashedParentPassword,
        role: "parent",
        tel: tutor.tel,
        address: tutor.address,
        gender: tutor.gender,
      },
    });

    const parent = await tx.parent.create({
      data: { userId: parentUser.id },
    });

    let message = `
Tuteur: ${tutor.firstname} ${tutor.lastname}
Nom d'utilisateur: ${parentUsername}
Mot de passe: ${parentPassword}


`;

    const studentResults = [];

    // 👨‍🎓 STUDENTS LOOP
    for (const studentInfo of enrollment.students) {
      const defaultClass = studentInfo.demanded_class_level
        ? await tx.class.findFirst({
            where: {
              grade: { level: studentInfo.demanded_class_level.level },
            },
            include: { grade: true },
          })
        : null;

      const canHaveAccount =
        studentInfo.demanded_class_level &&
        studentInfo.demanded_class_level.level > 0;

      let studentUser = null;
      let credentials = null;

      // 🔐 CREATE STUDENT ACCOUNT
      if (canHaveAccount) {
        const username = `${studentInfo.firstname}${randomInt(100, 999)}`;
        const password = `${randomInt(1000, 9999)}`;
        const hashed = await bcrypt.hash(password, 10);

        studentUser = await tx.user.create({
          data: {
            username,
            email: `${username}@lafamooai.local`,
            password: hashed,
            role: "student",
            gender: studentInfo.gender,
          },
        });

        credentials = { username, password };

        message += `
Elève: ${studentInfo.firstname} ${studentInfo.lastname}
Nom d'utilisateur: ${username}
Mot de passe: ${password}


`;
      }

      // 👨‍🎓 CREATE STUDENT
      const student = await tx.student.create({
        data: {
          parentId: parent.id_parent,
          accountId: studentUser?.id,
          first_name: studentInfo.firstname,
          last_name: studentInfo.lastname,
          CNI: studentInfo.cni || "-",
          gender: studentInfo.gender,
          classeId: defaultClass?.id_class,
        },
      });

      // pivot
      if (defaultClass) {
        await tx.classStudent.create({
          data: {
            classId: defaultClass.id_class,
            studentId: student.id_student,
          },
        });
      }

      // 💰 RECEIPT + FEES
      if (defaultClass?.grade?.enrollement_fee) {
        const receipt = await tx.receipt.create({
          data: {
            reference: await generateReceiptReference(tx),
            total_amount: defaultClass.grade.enrollement_fee,
          },
        });

        await tx.enrollementFeeDetails.create({
          data: {
            studentId: student.id_student,
            student_enrol_infoId:
              studentInfo.id_enrollement_student_info,
            receiptId: receipt.id_receipt,
          },
        });

        // ⚡ BULK months
        await tx.monthlyFeeDetails.createMany({
          data: Array.from({ length: 12 }, (_, i) => ({
            month: String(i + 1),
            studentId: student.id_student,
            classeId: defaultClass.id_class,
            receiptId: receipt.id_receipt,
          })),
        });
      }

      studentResults.push({
        student,
        credentials,
      });
    }

    // ✅ update status
    await tx.enrollement.update({
      where: { id_enrollement: enrollementId },
      data: { status: "Accepted" },
    });

    return {
      tutorEmail: tutor.email,
      message,
      parent: parentUser,
      students: studentResults,
    };
  });
};

// 📧 SEND MAIL (outside transaction)
const sendAccountEmail = async (to, message) => {
  await transporter.sendMail({
    from: `"Lafamooai" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Informations de connexion",
    text: message,
  });
};

module.exports = {
  acceptEnrollmentService,
  sendAccountEmail,
};