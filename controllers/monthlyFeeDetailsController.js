const pageLimit = parseInt(process.env.pageLimit, 10);
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { serializeStudent } = require('../serializers/studentSerializer');

const accessSECRET = process.env.ACCESS_SECRET || 'MY_ACCESS_SECRET_KEY';

/* =========================
   AUTH
========================= */
const decodeUser = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.startsWith('Token ')
    ? authHeader.slice(6)
    : authHeader;

  try {
    return jwt.verify(token, accessSECRET);
  } catch {
    return null;
  }
};

/* =========================
   UTILS
========================= */
const toStr = (m) => m.map(String);

const createStats = () => ({
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

/* =========================
   PARAMS (Django style source of truth)
========================= */
const getParams = async () => {
  const p = await prisma.monthlyFeeParams.findFirst();

  const start = p?.start_month ?? 10;
  const end = p?.end_month ?? 6;
  const school_years = p?.school_years ?? '2025-2026';
  const deadline = p?.deadline ?? 15;

  const [y1, y2] = school_years.split('-');
  const now = new Date();

  const month = now.getMonth() + 1;
  const year = String(now.getFullYear());

  const passed = [];
  const coming = [];

  const push = (from, to, arr) => {
    if (from <= to) {
      for (let i = from; i <= to; i++) arr.push(i);
    } else {
      for (let i = from; i <= 12; i++) arr.push(i);
      for (let i = 1; i <= to; i++) arr.push(i);
    }
  };

  if (month >= start && year === y1) {
    push(start, month, passed);
    push(month + 1, end - 1, coming);
  } else if (month < start && year === y2) {
    push(start, 12, passed);
    push(1, month, passed);
    push(month + 1, end - 1, coming);
  } else if (month < start) {
    push(start, 12, coming);
    push(1, end - 1, coming);
  } else {
    push(start, 12, passed);
    push(1, end - 1, passed);
  }

  return {
    school_years,
    start_month: start,
    end_month: end,
    actual_month: month,
    passed_months: toStr(passed),
    coming_months: toStr(coming),
    deadline,
  };
};

/* =========================
   SCOPED STUDENTS
========================= */
const getScopedStudents = async (user, schoolYears) => {
  if (!user) return [];

  const include = {
    account: true,
    parent: true,
    classe: { include: { grade: true } },
  };

  const base = { classe: { annee_academique: schoolYears } };

  if (user.role === 'admin')
    return prisma.student.findMany({ where: base, include });

  if (user.role === 'parent')
    return prisma.student.findMany({
      where: { ...base, parent: { userId: user.userId } },
      include,
    });

  if (user.role === 'student')
    return prisma.student.findMany({
      where: { ...base, accountId: user.userId },
      include,
    });

  return [];
};

/* =========================
   PAYMENT STATUS (CENTRAL LOGIC)
========================= */
const computeStatus = (params, fee, today) => {
  const month = String(fee.month);

  const isPaid = !!fee.receiptId;
  const isPast = params.passed_months.includes(month);
  const isComing = params.coming_months.includes(month);
  const isCurrent = month === String(params.actual_month);

  if (isPaid && isComing) return 'in_advance';
  if (isPaid) return 'at_day';

  if (!isPaid && isPast) return 'overdue';

  if (!isPaid && isCurrent && today.getDate() <= params.deadline)
    return 'waiting';

  if (!isPaid && isComing) return 'in_coming';

  return 'overdue';
};

/* =========================
   MONTHLY FEES LIST
========================= */
exports.getMonthlyFeeDetails = async (req, res) => {
  const user = decodeUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const search = req.query.search || '';
  const page = parseInt(req.query.page || 1);
  const limit = parseInt(req.query.limit || pageLimit);
  const skip = (page - 1) * limit;

  const where = {};

  if (search) {
    where.OR = [
      { student: { first_name: { contains: search, mode: 'insensitive' } } },
      { student: { last_name: { contains: search, mode: 'insensitive' } } },
      { classe: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  try {
    const total = await prisma.monthlyFeeDetails.count({ where });

    const results = await prisma.monthlyFeeDetails.findMany({
      where,
      include: {
        student: { include: { classe: { include: { grade: true } } } },
        receipt: true,
      },
      orderBy: { id_mthl_fd: 'asc' },
      skip,
      take: limit,
    });

    res.json({ count: total, results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

/* =========================
   MONTHLY FEE DETAIL BY ID
========================= */
exports.getMonthlyFeeDetailById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid monthly fee detail id' });
  }

  try {
    const detail = await prisma.monthlyFeeDetails.findUnique({
      where: { id_mthl_fd: id },
      include: {
        student: { include: 
          { account: true,
            classe: { include: { grade: true } }, 
            parent: true } 
        },
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

/* =========================
   PAYMENT INFOS (CLEAN)
========================= */
exports.payementInfos = async (req, res) => {
  try {
    const user = req.user;
    const params = await getParams();
    const today = new Date();

    const students = await getScopedStudents(user, params.school_years);
    if (!students.length) return res.json({ results: [] });

    const fees = await prisma.monthlyFeeDetails.findMany({
      where: {
        studentId: { in: students.map(s => s.id_student) },
        school_years: params.school_years,
      },
    });

    const map = {};
    fees.forEach(f => {
      if (!map[f.studentId]) map[f.studentId] = [];
      map[f.studentId].push(f);
    });

    const results = [];

    for (const s of students) {
      const studentFees = map[s.id_student] || [];

      const inAdvance = [];
      const overdue = [];
      let receipt = null;
      let currentPaid = false;

      for (const f of studentFees) {
        if (!receipt && f.receiptId) receipt = f.receiptId;

        const status = computeStatus(params, f, today);

        if (status === 'in_advance') inAdvance.push(f.month);
        if (status === 'overdue') overdue.push(f.month);
        if (status === 'at_day' && Number(f.month) === params.actual_month)
          currentPaid = true;
      }

      let status = 'at_day';
      let months = [];

      if (inAdvance.length) {
        status = 'in_advance';
        months = inAdvance;
      } else if (currentPaid) {
        status = 'at_day';
        months = [params.actual_month];
      } else if (overdue.length) {
        status = 'overdue';
        months = overdue;
      }

      results.push({
        student: serializeStudent(s),
        payement_status: status,
        total_month: months.length,
        month_details: months,
        receipt,
      });
    }

    res.json({ message: 'All payement infos', results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

/* =========================
   MAKE PAYMENT
========================= */
exports.makePayement = async (req, res) => {
  const user = decodeUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const id = parseInt(req.body.id_mthl_fd, 10);
  if (Number.isNaN(id))
    return res.status(400).json({ error: 'Invalid payment id' });

  try {
    const fee = await prisma.monthlyFeeDetails.findUnique({
      where: { id_mthl_fd: id },
      include: {
        student: { include: { classe: { include: { grade: true } } } },
      },
    });

    if (!fee)
      return res.status(404).json({ error: 'Monthly fee not found' });

    const amount = fee.student?.classe?.grade?.monthly_fee ?? 0;

    const receipt = await prisma.receipt.create({
      data: {
        reference: `FSM${Date.now()}`,
        total_amount: amount,
      },
    });

    await prisma.monthlyFeeDetails.update({
      where: { id_mthl_fd: id },
      data: { receiptId: receipt.id_receipt },
    });

    res.json({
      message: 'Payment success',
      receiptId: receipt.id_receipt,
      amount,
      month_status: 'at_day',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

/* =========================
   STUDENT PAYMENTS
========================= */
exports.studentPayements = async (req, res) => {
  try {
    const studentId = parseInt(req.body.student_id, 10);
    if (Number.isNaN(studentId))
      return res.status(400).json({ error: 'Invalid student id' });

    const params = await getParams();

    const student = await prisma.student.findUnique({
      where: { id_student: studentId },
      include: { classe: { include: { grade: true } } },
    });

    if (!student)
      return res.status(404).json({ error: 'Student not found' });

    const fees = await prisma.monthlyFeeDetails.findMany({
      where: {
        studentId,
        school_years: params.school_years,
      },
      include: { receipt: true },
    });

    const results = fees.map(f => ({
      payement: {
        ...f,
        amount: student.classe?.grade?.monthly_fee ?? 0,
      },
      month_status: computeStatus(params, f, new Date()),
    }));

    res.json({ message: 'Student payements', results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

const generateReceiptReference = async (code = 'FSM') => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.receipt.count();
  return `${code}${dateStr}${count + 1}`;
};

/* =========================
   CREATE RECEIPT
========================= */
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

/* =========================
   FINANCIAL STATS
========================= */
exports.financialStats = async (req, res) => {
  try {
    const user = req.user;
    const params = await getParams();

    // ❌ FIX IMPORTANT: ne PAS filtrer sur classe année (cause de ton 0 stats)
    const students = await prisma.student.findMany({
      where:
        user.role === 'parent'
          ? { parent: { userId: user.userId } }
          : user.role === 'student'
          ? { accountId: user.userId }
          : {},
      include: {
        classe: { include: { grade: true } },
      },
    });

    if (!students.length) {
      return res.json({ results: [createStats()] });
    }

    const studentMap = {};
    for (const s of students) {
      studentMap[s.id_student] = s;
    }

    const fees = await prisma.monthlyFeeDetails.findMany({
      where: {
        studentId: { in: students.map(s => s.id_student) },
        school_years: params.school_years,
      },
      select: {
        studentId: true,
        month: true,
        receiptId: true,
      },
    });

    const stats = createStats();
    const actualMonth = String(params.actual_month);

    for (const fee of fees) {
      const month = String(fee.month);
      const student = studentMap[fee.studentId];
      const price = student?.classe?.grade?.monthly_fee || 0;

      const isPaid = !!fee.receiptId;
      const isPast = params.passed_months.includes(month);
      const isComing = params.coming_months.includes(month);

      // =====================
      // TOTAL PAID
      // =====================
      if (isPaid) {
        stats.total_paid_number++;
        stats.total_paid_amount += price;
      }

      // =====================
      // OVERDUE
      // =====================
      if (!isPaid && isPast) {
        stats.total_overdue_number++;
        stats.total_overdue_amount += price;
      }

      // =====================
      // CURRENT MONTH
      // =====================
      if (month === actualMonth && isPaid) {
        stats.paid_this_month_num++;
        stats.paid_this_month_aut += price;
      }

      // =====================
      // IN ADVANCE
      // =====================
      if (isPaid && isComing) {
        stats.in_advance_amount += price;
      }
    }

    // =====================
    // OVERDUE THIS MONTH (SAFE FIX)
    // =====================
    stats.this_month_overdue_num =
      Math.max(0, students.length - stats.paid_this_month_num);

    const avgPrice =
      students[0]?.classe?.grade?.monthly_fee || 0;

    stats.this_month_overdue_aut =
      stats.this_month_overdue_num * avgPrice;

    return res.json({ results: [stats] });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};