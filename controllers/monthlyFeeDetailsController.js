const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');
const { serializeStudent } = require('../serializers/studentSerializer');
const { createStats, getParams, getSchoolDate, getScopedStudents, enrichFee } = require('../utils/monthlyFeeDetailsUtils');

/* =========================
   MONTHLY FEES LIST
========================= */
exports.getMonthlyFeeDetails = async (req, res) => {
  const user = req.user;
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
  const user = req.user;
  if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
  }
  
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
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
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
    const actualMonth = today.getMonth() + 1;

    for (const s of students) {
      const studentFees = map[s.id_student] || [];

      const statuses = {
          overdue: [],
          waiting: [],
          in_coming: [],
          in_advance: [],
          at_day: [],
      };

      let receipt = null;

      for (const f of studentFees) {

          const fee = enrichFee(f, s, params, today);

          if (!receipt && fee.receiptId)
              receipt = fee.receiptId;

          statuses[fee.status]?.push(fee.month);
      }

      let payement_status = "at_day";
      let month_details = [];

      if (statuses.overdue.length) {
          payement_status = "overdue";
          month_details = statuses.overdue;
      }
      else if (statuses.waiting.length) {
          payement_status = "waiting";
          month_details = statuses.waiting;
      }
      else if (statuses.in_coming.length) {
          payement_status = "in_coming";
          month_details = statuses.in_coming;
      }
      else if (statuses.in_advance.length) {
          payement_status = "in_advance";
          month_details = statuses.in_advance;
      }
      else if (statuses.at_day.length) {
          payement_status = "at_day";
          month_details = statuses.at_day;
      }

      results.push({
          student: serializeStudent(s),
          payement_status,
          total_month: month_details.length,
          month_details,
          receipt,
          statuses,
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
============================ */
exports.makePayement = async (req, res) => {
  const user = req.user;

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

    if (!fee) {
        return res.status(404).json({ error: 'Payment not found' });
    }

    if (fee.receiptId) {
        return res.status(400).json({
            error: "This monthly fee has already been paid.",
        });
    }
    if (!fee.student?.classe?.grade) {
        return res.status(500).json({
          error: "Informations sur la classe ou le niveau de leleve manquant",
        });
      }

    const result = await prisma.$transaction(async (tx) => {
      

      const amount = fee.student.classe.grade.monthly_fee;
      
      const receipt = await createReceipt(tx, amount);

      await tx.monthlyFeeDetails.update({
        where: { id_mthl_fd: fee.id_mthl_fd },
        data: { receiptId: receipt.id_receipt },
      });

      const allFees = await tx.monthlyFeeDetails.findMany({
          where: {
              studentId: fee.studentId,
              school_years: fee.school_years,
          },
      });
      const statuses = {
          overdue: [],
          waiting: [],
          in_coming: [],
          at_day: [],
          in_advance: [],
      };

      const today = new Date();
      const params = await getParams();

      for (const f of allFees) {
          const info = enrichFee(f, fee.student, params, today);
          statuses[info.status].push(info.month);
      }
      let payement_status = "at_day";
      let month_details = [];

      if (statuses.overdue.length) {
          payement_status = "overdue";
          month_details = statuses.overdue;
      }
      else if (statuses.waiting.length) {
          payement_status = "waiting";
          month_details = statuses.waiting;
      }
      else if (statuses.in_coming.length) {
          payement_status = "in_coming";
          month_details = statuses.in_coming;
      }
      else if (statuses.in_advance.length) {
          payement_status = "in_advance";
          month_details = statuses.in_advance;
      }
      else {
          payement_status = "at_day";
          month_details = statuses.at_day;
      }

      return {
        message: "Payment success",
        receiptId: receipt.id_receipt,
        receipt,
        amount,

        statuses,
        payement_status,
        month_details,
      };
    });

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};

/* =========================
   STUDENT PAYMENTS
========================= */
exports.studentPayements = async (req, res) => {
  const user = req.user;

  if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
  }
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

    const results = fees.map(f => {
        const fee = enrichFee(f, student, params);

        return {
            payement: fee,
            month_status: fee.status,
            isCurrent: fee.isCurrent,
            isPaid: fee.isPaid,
        };
    });

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
const createReceipt = async (tx, amount) => {

    return tx.receipt.create({
        data: {
            reference: await generateReceiptReference(),
            total_amount: amount,
        },
    });

};

/* =========================
   CREATE RECEIPT
========================= */
exports.createReceiptController = async (req, res) => {
  const user = req.user;
  if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
  }
  
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

    const result = await prisma.$transaction(async (tx) => {
        const receipt = await createReceipt(tx, total_amount);

        await tx.monthlyFeeDetails.update({
            where: { id_mthl_fd: id },
            data: {
                receiptId: receipt.id_receipt,
            },
        });

        return receipt;
    });

    return res.status(201).json({
        message: "Receipt created successfully",
        receipt: result,
    });

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
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

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

    const today = new Date();

    for (const fee of fees) {
      const student = studentMap[fee.studentId];
      const enrichedFee = enrichFee(
          fee,
          student,
          params,
          today
      );

      const price = enrichedFee.amount;

      switch (enrichedFee.status) {

          case "at_day":

              stats.total_paid_number++;
              stats.total_paid_amount += price;

              if (enrichedFee.isCurrent) {
                  stats.paid_this_month_num++;
                  stats.paid_this_month_aut += price;
              }

              break;

          case "in_advance":

              stats.total_paid_number++;
              stats.total_paid_amount += price;
              stats.in_advance_amount += price;

              break;

          case "waiting":

              if (enrichedFee.isCurrent) {
                  stats.this_month_overdue_num++;
                  stats.this_month_overdue_aut += price;
              }

              break;

          case "overdue":

              stats.total_overdue_number++;
              stats.total_overdue_amount += price;

              if (enrichedFee.isCurrent) {
                  stats.this_month_overdue_num++;
                  stats.this_month_overdue_aut += price;
              }

              break;
      }
    }

    return res.json({
      results: {
        stats,
        params: {
          school_year: params.school_years,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};