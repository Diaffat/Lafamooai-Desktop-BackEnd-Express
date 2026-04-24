const pageLimit = parseInt(process.env.pageLimit, 10);
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { serializeStudent } = require('../serializers/studentSerializer');

const accessSECRET = process.env.ACCESS_SECRET || 'MY_ACCESS_SECRET_KEY';

const decodeUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.startsWith('Token ') ? authHeader.slice(6) : authHeader;
  try {
    return jwt.verify(token, accessSECRET);
  } catch (err) {
    return null;
  }
};

const toStringMonths = (months) => months.map(String);

const getParams = async () => {
  const params = await prisma.monthlyFeeParams.findFirst();
  const startMonth = params?.start_month ?? 10;
  const endMonth = params?.end_month ?? 6;
  const school_years = params?.school_years ?? '2025-2026';
  const deadline = params?.deadline ?? 15;

  const school_years_list = school_years.split('-');
  const now = new Date();
  const actual_month = now.getMonth() + 1;
  const actual_year = String(now.getFullYear());

  const passed_months = [];
  const coming_months = [];

  if (actual_month >= startMonth && school_years_list[0] === actual_year) {
    for (let m = startMonth; m <= actual_month; m += 1) {
      passed_months.push(m);
    }
    for (let m = actual_month + 1; m <= 12; m += 1) {
      coming_months.push(m);
    }
    for (let m = 1; m < endMonth; m += 1) {
      coming_months.push(m);
    }
  } else if (actual_month < startMonth && school_years_list[1] === actual_year) {
    for (let m = startMonth; m <= 12; m += 1) {
      passed_months.push(m);
    }
    if (actual_month < endMonth) {
      for (let m = 1; m <= actual_month; m += 1) {
        passed_months.push(m);
      }
    } else {
      for (let m = 1; m < endMonth; m += 1) {
        passed_months.push(m);
      }
    }
    for (let m = actual_month + 1; m < endMonth; m += 1) {
      coming_months.push(m);
    }
  } else if (actual_month < startMonth && school_years_list[0] === actual_year) {
    for (let m = startMonth; m <= 12; m += 1) {
      coming_months.push(m);
    }
    for (let m = 1; m < endMonth; m += 1) {
      coming_months.push(m);
    }
  } else {
    for (let m = startMonth; m <= 12; m += 1) {
      passed_months.push(m);
    }
    for (let m = 1; m < endMonth; m += 1) {
      passed_months.push(m);
    }
  }

  return {
    school_years,
    start_month: startMonth,
    end_month: endMonth,
    school_years_list,
    actual_month,
    actual_year,
    passed_months: toStringMonths(passed_months),
    coming_months: toStringMonths(coming_months),
    deadline,
  };
};

const getStudentForUser = async (user) => {
  if (!user) return null;
  return prisma.student.findFirst({
    where: { accountId: user.userId },
  });
};

const getParentForUser = async (user) => {
  if (!user) return null;
  return prisma.parent.findFirst({
    where: { userId: user.userId },
  });
};

const createEmptyFinancialStats = () => ({
  total_paid_number: 0,
  total_paid_amount: 0,
  total_overdue_number: 0,
  total_overdue_amount: 0,
  paid_this_month_num: 0,
  paid_this_month_aut: 0,
  this_month_overdue_num: 0,
  this_month_overdue_aut: 0,
  in_advance_amount: 0,
});

const getScopedStudents = async (user, schoolYears) => {
  if (!user) return [];

  const include = {
    account: true,
    parent: { include: { user: true } },
    classe: { include: { grade: true } },
  };

  if (user.role === 'admin') {
    return prisma.student.findMany({
      where: { classe: { annee_academique: schoolYears } },
      include,
    });
  }

  if (user.role === 'parent') {
    return prisma.student.findMany({
      where: {
        parent: { userId: user.userId },
        classe: { annee_academique: schoolYears },
      },
      include,
    });
  }

  if (user.role === 'student') {
    return prisma.student.findMany({
      where: {
        accountId: user.userId,
        classe: { annee_academique: schoolYears },
      },
      include,
    });
  }

  return [];
};

exports.getMonthlyFeeDetails = async (req, res) => {
  const user = decodeUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const search = req.query.search || '';
  const page = parseInt(req.query.page, pageLimit) || 1;
  const limit = parseInt(req.query.limit, pageLimit) || pageLimit;
  const offset = (page - 1) * limit;

  const where = {};

  if (search) {
    where.OR = [
      { student: { first_name: { contains: search, mode: 'insensitive' } } },
      { student: { last_name: { contains: search, mode: 'insensitive' } } },
      { classe: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (user.role === 'student') {
    const student = await getStudentForUser(user);
    if (!student) {
      return res.json({ count: 0, results: [] });
    }
    where.studentId = student.id_student;
  } else if (user.role === 'parent') {
    const parent = await getParentForUser(user);
    if (!parent) {
      return res.json({ count: 0, results: [] });
    }
    where.student = { parentId: parent.id_parent };
  } else if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const total = await prisma.monthlyFeeDetails.count({ where });
    const results = await prisma.monthlyFeeDetails.findMany({
      where,
      include: {
        student: {
          include: {
            account: true,
            classe: { include: { grade: true } },
            parent: true,
          },
        },
        classe: { include: { grade: true } },
        receipt: true,
      },
      orderBy: { id_mthl_fd: 'asc' },
      skip: offset,
      take: limit,
    });

    return res.json({ count: total, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getMonthlyFeeDetailById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee detail id' });
  }

  try {
    const detail = await prisma.monthlyFeeDetails.findUnique({
      where: { id_mthl_fd: id },
      include: {
        student: { include: { account: true, classe: { include: { grade: true } }, parent: true } },
        classe: { include: { grade: true } },
        receipt: true,
      },
    });

    if (!detail) {
      return res.status(404).json({ error: 'Monthly fee detail not found' });
    }

    return res.json(detail);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

const generateReceiptReference = async (code = 'FSM') => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.receipt.count();
  return `${code}${dateStr}${count + 1}`;
};

exports.createReceipt = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee detail id' });
  }

  try {
    const monthlyFd = await prisma.monthlyFeeDetails.findUnique({
      where: { id_mthl_fd: id },
      include: {
        student: { include: { classe: { include: { grade: true } } } },
      },
    });

    if (!monthlyFd) {
      return res.status(404).json({ error: 'Monthly fee detail not found' });
    }

    const total_amount = monthlyFd.student?.classe?.grade?.monthly_fee ?? 0;
    const reference = await generateReceiptReference('FSM');

    const receipt = await prisma.receipt.create({
      data: {
        reference,
        total_amount,
      },
    });

    await prisma.monthlyFeeDetails.update({
      where: { id_mthl_fd: id },
      data: { receiptId: receipt.id_receipt },
    });

    return res.status(201).json({ message: 'Receipt created successfully', receipt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.financialStats = async (req, res) => {
  try {
    const user = req.user; // via middleware
    const params = await getParams();

    // ================= GET STUDENTS =================
    const students = await prisma.student.findMany({
      where: {
        classe: { annee_academique: params.school_years },
        ...(user.role === 'parent'
          ? { parent: { userId: user.userId } }
          : {}),
      },
      include: {
        classe: {
          include: { grade: true },
        },
      },
    });

    if (students.length === 0) {
      return res.json({ results: [{}] });
    }

    const studentIds = students.map(s => s.id_student);

    // ================= GET ALL FEES (1 QUERY) =================
    const fees = await prisma.monthlyFeeDetails.findMany({
      where: {
        studentId: { in: studentIds },
        school_years: params.school_years,
      },
      select: {
        studentId: true,
        month: true,
        receiptId: true,
      },
    });

    // ================= MAP STUDENTS =================
    const studentMap = {};
    students.forEach(s => {
      studentMap[s.id_student] = s;
    });

    // ================= INIT STATS =================
    let stats = {
      total_paid_number: 0,
      total_paid_amount: 0,
      total_overdue_number: 0,
      total_overdue_amount: 0,
      paid_this_month_num: 0,
      paid_this_month_aut: 0,
      this_month_overdue_num: 0,
      this_month_overdue_aut: 0,
      in_advance_amount: 0,
    };

    const actualMonth = String(params.actual_month);

    // ================= PROCESS FEES =================
    for (const fee of fees) {
      const student = studentMap[fee.studentId];
      const price = student?.classe?.grade?.monthly_fee || 0;

      const isPaid = !!fee.receiptId;
      const isPassed = params.passed_months.includes(fee.month);
      const isComing = params.coming_months.includes(fee.month);

      // ✅ TOTAL PAID
      if (isPaid) {
        stats.total_paid_number++;
        stats.total_paid_amount += price;
      }

      // ❌ OVERDUE
      if (!isPaid && isPassed) {
        stats.total_overdue_number++;
        stats.total_overdue_amount += price;
      }

      // 📅 THIS MONTH
      if (fee.month === actualMonth) {
        if (isPaid) {
          stats.paid_this_month_num++;
          stats.paid_this_month_aut += price;
        }
      }

      // 🚀 IN ADVANCE
      if (isPaid && isComing) {
        stats.in_advance_amount += price;
      }
    }

    // ================= STUDENT-LEVEL CALC =================
    const studentCount = students.length;
    stats.this_month_overdue_num =
      studentCount - stats.paid_this_month_num;

    const avgPrice =
      students[0]?.classe?.grade?.monthly_fee || 0;

    stats.this_month_overdue_aut =
      stats.this_month_overdue_num * avgPrice;

    // ================= RESPONSE =================
    return res.json({
      results: [stats],
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.payementInfos = async (req, res) => {
  try {
    const user = req.user;
    const params = await getParams();
    const today = new Date();
    const actualMonth = String(today.getMonth() + 1);

    // ================= GET STUDENTS =================
    let students = await prisma.student.findMany({
      where: {
        classe: { annee_academique: params.school_years },
        ...(user.role === 'parent'
          ? { parent: { userId: user.userId } }
          : user.role === 'student'
          ? { accountId: user.userId }
          : {}),
      },
    });

    if (students.length === 0) {
      return res.json({ results: [] });
    }

    const studentIds = students.map(s => s.id_student);

    // ================= GET ALL FEES =================
    const fees = await prisma.monthlyFeeDetails.findMany({
      where: {
        studentId: { in: studentIds },
        school_years: params.school_years,
      },
      select: {
        studentId: true,
        month: true,
        receiptId: true,
      },
    });

    // ================= GROUP BY STUDENT =================
    const feesMap = {};
    fees.forEach(f => {
      if (!feesMap[f.studentId]) feesMap[f.studentId] = [];
      feesMap[f.studentId].push(f);
    });

    // ================= BUILD RESULT =================
    const results = [];

    for (const student of students) {
      const studentFees = feesMap[student.id_student] || [];

      const inAdvance = [];
      const overdues = [];
      let actualPaid = false;
      let receiptId = null;

      for (const fee of studentFees) {
        if (fee.receiptId && receiptId === null) {
          receiptId = fee.receiptId;
        }

        if (fee.month === actualMonth && fee.receiptId) {
          actualPaid = true;
        }

        if (params.coming_months.includes(fee.month) && fee.receiptId) {
          inAdvance.push(fee.month);
        }

        if (
          params.passed_months.includes(fee.month) &&
          !fee.receiptId
        ) {
          overdues.push(fee.month);
        }
      }

      let status = "at_day";
      let months = [];

      if (inAdvance.length > 0) {
        status = "in_advance";
        months = inAdvance;
      } else if (actualPaid) {
        status = "at_day";
        months = [params.actual_month];
      } else if (today.getDate() <= params.deadline) {
        if (overdues.length === 1) {
          status = "waiting";
          months = [params.actual_month];
        } else if (overdues.length > 1) {
          status = "overdue";
          months = overdues;
        }
      } else {
        status = "overdue";
        months = overdues;
      }

      results.push({
        student,
        payement_status: status,
        total_month: months.length,
        month_details: months,
        receipt: receiptId,
      });
    }

    return res.json({
      message: "All payement infos",
      results,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.makePayement = async (req, res) => {
  const user = decodeUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payement_id = parseInt(req.body.id_mthl_fd, 10);
  if (Number.isNaN(payement_id)) {
    return res.status(400).json({ error: 'Invalid payment id' });
  }

  try {
    const monthlyFeeDtls = await prisma.monthlyFeeDetails.findUnique({
      where: { id_mthl_fd: payement_id },
      include: { student: { include: { classe: { include: { grade: true } } } } },
    });

    if (!monthlyFeeDtls) {
      return res.status(404).json({ error: 'Monthly fee detail not found' });
    }

    const reference = await generateReceiptReference('FSM');
    const total_amount = monthlyFeeDtls.student?.classe?.grade?.monthly_fee ?? 0;

    const receipt = await prisma.receipt.create({
      data: {
        reference,
        total_amount,
      },
    });

    const updatedMonthlyFee = await prisma.monthlyFeeDetails.update({
      where: { id_mthl_fd: payement_id },
      data: { receiptId: receipt.id_receipt },
      include: { receipt: true },
    });

    return res.status(200).json({
      message: 'Payement successfully',
      receipt,
      month_status: 'at_day',
      amount: total_amount,
      updated_at: updatedMonthlyFee.updated_at,
      receiptId: receipt.id_receipt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.studentPayements = async (req, res) => {
  try {
    const student_id = parseInt(req.body.student_id, 10);
    if (Number.isNaN(student_id)) {
      return res.status(400).json({ error: "Invalid student id" });
    }

    const params = await getParams();
    const today = new Date();

    // ================= GET ALL FEES =================
    const fees = await prisma.monthlyFeeDetails.findMany({
      where: {
        studentId: student_id,
        school_years: params.school_years,
      },
      include: {
        student: { include: { classe: { include: { grade: true } } } },
        receipt: true,
      },
    });

    const results = [];

    for (const fee of fees) {
      let status;
      const amount = fee.student?.classe?.grade?.monthly_fee ?? 0;
      const receipt = fee.receipt ? fee.receipt : null;

      if (params.passed_months.includes(fee.month)) {
        if (fee.receiptId) {
          status = "at_day";
        } else if (
          parseInt(fee.month) === params.actual_month &&
          today.getDate() <= params.deadline
        ) {
          status = "waiting";
        } else {
          status = "overdue";
        }
      } else if (params.coming_months.includes(fee.month)) {
        status = fee.receiptId ? "in_advance" : "in_coming";
      }

      results.push({
        payement: {
          ...fee,
          amount,
          receipt,
        },
        month_status: status,
      });
    }

    return res.json({
      message: "Student payement info",
      results,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

// Keep the active monthly fee flow aligned with the Django source implementation.
const alignedFinancialStats = async (req, res) => {
  try {
    const user = req.user;
    const params = await getParams();
    const stats = createEmptyFinancialStats();
    let parentStudents = [];
    let classes = [];

    if (user.role === 'parent') {
      parentStudents = await getScopedStudents(user, params.school_years);

      const uniqueClasses = new Map();
      parentStudents.forEach((student) => {
        if (student.classe?.id_class) {
          uniqueClasses.set(student.classe.id_class, student.classe);
        }
      });
      classes = Array.from(uniqueClasses.values());
    } else {
      classes = await prisma.class.findMany({
        where: { annee_academique: params.school_years },
        include: { grade: true },
      });
    }

    for (const clss of classes) {
      const classStudents = user.role === 'parent'
        ? parentStudents.filter((student) => student.classeId === clss.id_class)
        : await prisma.student.findMany({
            where: { classeId: clss.id_class },
            select: { id_student: true },
          });

      const classStudentIds = classStudents
        .map((student) => student.id_student)
        .filter((id) => id != null);

      const classSize = classStudentIds.length;
      if (classSize === 0) {
        continue;
      }

      const [classPaid, classOverdue, paidThisMonth] = await Promise.all([
        prisma.monthlyFeeDetails.count({
          where: {
            studentId: { in: classStudentIds },
            school_years: params.school_years,
            receiptId: { not: null },
          },
        }),
        prisma.monthlyFeeDetails.count({
          where: {
            studentId: { in: classStudentIds },
            school_years: params.school_years,
            month: { in: params.passed_months },
            receiptId: null,
          },
        }),
        prisma.monthlyFeeDetails.count({
          where: {
            studentId: { in: classStudentIds },
            school_years: params.school_years,
            month: String(params.actual_month),
            receiptId: { not: null },
          },
        }),
      ]);

      const monthlyFee = clss.grade?.monthly_fee ?? 0;

      stats.total_paid_number += classPaid;
      stats.total_paid_amount += classPaid * monthlyFee;
      stats.total_overdue_number += classOverdue;
      stats.total_overdue_amount += classOverdue * monthlyFee;
      stats.paid_this_month_num += paidThisMonth;
      stats.paid_this_month_aut += paidThisMonth * monthlyFee;
      stats.this_month_overdue_num += classSize - paidThisMonth;
      stats.this_month_overdue_aut += (classSize - paidThisMonth) * monthlyFee;
    }

    const parentStudentIds = parentStudents.map((student) => student.id_student);
    const inAdvancePayments = user.role === 'parent' && parentStudentIds.length === 0
      ? []
      : await prisma.monthlyFeeDetails.findMany({
          where: {
            ...(user.role === 'parent'
              ? { studentId: { in: parentStudentIds } }
              : {}),
            month: { in: params.coming_months },
            school_years: params.school_years,
            receiptId: { not: null },
          },
          include: {
            student: {
              include: {
                classe: { include: { grade: true } },
              },
            },
          },
        });

    stats.in_advance_amount = inAdvancePayments.reduce(
      (sum, payement) => sum + (payement.student?.classe?.grade?.monthly_fee ?? 0),
      0,
    );

    return res.json({ results: [stats] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

const alignedPayementInfos = async (req, res) => {
  try {
    const user = req.user;
    const params = await getParams();
    const today = new Date();
    const students = await getScopedStudents(user, params.school_years);

    if (students.length === 0) {
      return res.json({ message: 'All payement infos', results: [] });
    }

    const payementData = [];

    if (params.passed_months.length === 0) {
      students.forEach((student) => {
        payementData.push({
          student: serializeStudent(student),
          payement_status: 'at_day',
        });
      });

      return res.json({ message: 'All payement infos', results: payementData });
    }

    for (const student of students) {
      const [actualMonthPayement, inAdvance, firstPaidFee] = await Promise.all([
        prisma.monthlyFeeDetails.findFirst({
          where: {
            studentId: student.id_student,
            month: String(params.actual_month),
            school_years: params.school_years,
          },
          select: {
            receiptId: true,
          },
        }),
        prisma.monthlyFeeDetails.findMany({
          where: {
            studentId: student.id_student,
            month: { in: params.coming_months },
            school_years: params.school_years,
            receiptId: { not: null },
          },
          select: {
            month: true,
            receiptId: true,
          },
          orderBy: { id_mthl_fd: 'asc' },
        }),
        prisma.monthlyFeeDetails.findFirst({
          where: {
            studentId: student.id_student,
            school_years: params.school_years,
            receiptId: { not: null },
          },
          select: { receiptId: true },
          orderBy: { id_mthl_fd: 'asc' },
        }),
      ]);

      const studentPayementInfo = {
        student: serializeStudent(student),
        receipt: firstPaidFee?.receiptId,
      };

      const inAdvanceMonths = inAdvance.map((item) => Number(item.month));

      if (inAdvanceMonths.length > 0) {
        studentPayementInfo.payement_status = 'in_advance';
        studentPayementInfo.total_month = inAdvanceMonths.length;
        studentPayementInfo.month_details = inAdvanceMonths;
      } else if (actualMonthPayement?.receiptId) {
        studentPayementInfo.payement_status = 'at_day';
        studentPayementInfo.month_details = [params.actual_month];
      } else {
        const overdues = await prisma.monthlyFeeDetails.findMany({
          where: {
            studentId: student.id_student,
            month: { in: params.passed_months },
            school_years: params.school_years,
            receiptId: null,
          },
          select: { month: true },
          orderBy: { id_mthl_fd: 'asc' },
        });

        const overdueMonths = overdues.map((item) => Number(item.month));

        if (today.getDate() <= params.deadline) {
          if (overdueMonths.length === 1) {
            studentPayementInfo.payement_status = 'waiting';
            studentPayementInfo.total_month = 1;
            studentPayementInfo.month_details = [params.actual_month];
          } else if (overdueMonths.length > 1) {
            studentPayementInfo.payement_status = 'overdue';
            studentPayementInfo.total_month = overdueMonths.length;
            studentPayementInfo.month_details = overdueMonths;
          }
        } else {
          studentPayementInfo.payement_status = 'overdue';
          studentPayementInfo.total_month = overdueMonths.length;
          studentPayementInfo.month_details = overdueMonths;
        }
      }

      payementData.push(studentPayementInfo);
    }

    return res.json({
      message: 'All payement infos',
      results: payementData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

const alignedMakePayement = async (req, res) => {
  const user = decodeUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payement_id = parseInt(req.body.id_mthl_fd, 10);
  if (Number.isNaN(payement_id)) {
    return res.status(400).json({ error: 'Invalid payment id' });
  }

  try {
    const monthlyFeeDtls = await prisma.monthlyFeeDetails.findUnique({
      where: { id_mthl_fd: payement_id },
      include: { student: { include: { classe: { include: { grade: true } } } } },
    });

    if (!monthlyFeeDtls) {
      return res.status(404).json({ error: 'Monthly fee detail not found' });
    }

    const reference = await generateReceiptReference('FSM');
    const total_amount = monthlyFeeDtls.student?.classe?.grade?.monthly_fee ?? 0;

    const receipt = await prisma.receipt.create({
      data: {
        reference,
        total_amount,
        school_years: monthlyFeeDtls.school_years,
      },
    });

    const updatedMonthlyFee = await prisma.monthlyFeeDetails.update({
      where: { id_mthl_fd: payement_id },
      data: { receiptId: receipt.id_receipt },
    });

    return res.status(200).json({
      message: 'Payement successfully',
      id_mthl_fd: updatedMonthlyFee.id_mthl_fd,
      month: updatedMonthlyFee.month,
      school_years: updatedMonthlyFee.school_years,
      updated_at: updatedMonthlyFee.updated_at,
      receipt: receipt.id_receipt,
      receiptId: receipt.id_receipt,
      amount: total_amount,
      month_status: 'at_day',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

const alignedStudentPayements = async (req, res) => {
  try {
    const student_id = parseInt(req.body.student_id, 10);
    if (Number.isNaN(student_id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const params = await getParams();
    const today = new Date();
    const student = await prisma.student.findUnique({
      where: { id_student: student_id },
      include: { classe: { include: { grade: true } } },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const amount = student.classe?.grade?.monthly_fee ?? 0;

    const [passedMonths, comingMonths] = await Promise.all([
      prisma.monthlyFeeDetails.findMany({
        where: {
          studentId: student_id,
          month: { in: params.passed_months },
          school_years: params.school_years,
        },
        orderBy: { id_mthl_fd: 'asc' },
      }),
      prisma.monthlyFeeDetails.findMany({
        where: {
          studentId: student_id,
          month: { in: params.coming_months },
          school_years: params.school_years,
        },
        orderBy: { id_mthl_fd: 'asc' },
      }),
    ]);

    const results = [];

    passedMonths.forEach((payement) => {
      let month_status = 'overdue';

      if (payement.receiptId) {
        month_status = 'at_day';
      } else if (
        parseInt(payement.month, 10) === params.actual_month &&
        today.getDate() <= params.deadline
      ) {
        month_status = 'waiting';
      }

      results.push({
        payement: {
          ...payement,
          amount,
          receipt: payement.receiptId,
        },
        month_status,
      });
    });

    comingMonths.forEach((payement) => {
      results.push({
        payement: {
          ...payement,
          amount,
          receipt: payement.receiptId,
        },
        month_status: payement.receiptId ? 'in_advance' : 'in_coming',
      });
    });

    return res.json({
      message: 'Student payement info',
      results,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.financialStats = alignedFinancialStats;
exports.payementInfos = alignedPayementInfos;
exports.makePayement = alignedMakePayement;
exports.studentPayements = alignedStudentPayements;
