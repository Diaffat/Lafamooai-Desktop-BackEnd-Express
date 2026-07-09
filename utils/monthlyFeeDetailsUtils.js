const prisma = require('../prisma');

/* =========================
   UTILS
=========================== */

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
const getCurrentSchoolYear = () => {
    const today = new Date();

    // Mois JS : 0 = janvier, ..., 11 = décembre
    // Si l'année scolaire commence en septembre
    const startMonth = 9;

    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    if (currentMonth >= startMonth) {
        return `${currentYear}-${currentYear + 1}`;
    }

    return `${currentYear - 1}-${currentYear}`;
};

const getParams = async () => {
  const p = await prisma.monthlyFeeParams.findFirst();

  return {
    school_years: p?.school_years ?? getCurrentSchoolYear(),
    start_month: p?.start_month ?? 9,
    end_month: p?.end_month ?? 6,
    deadline: p?.deadline ?? 15,
  };
};

const getSchoolDate = (month, schoolYears, startMonth) => {

    const [startYear, endYear] =
        schoolYears.split("-").map(Number);

    // Cas année civile (janvier → août ou janvier → décembre)
    if (startMonth === 1) {
        return new Date(endYear, month - 1, 1);
    }

    // Cas année scolaire classique (septembre → juin)
    return new Date(
        month >= startMonth
            ? startYear
            : endYear,
        month - 1,
        1
    );
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
const computeStatus = (params, fee, today = new Date()) => {

    const feeDate = getSchoolDate(
        Number(fee.month),
        params.school_years,
        params.start_month
    );

    const currentMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
    );

    const isPaid = !!fee.receiptId;

    let status;

    if (feeDate > currentMonth) {

        status = isPaid
            ? "in_advance"
            : "in_coming";

    } else if (feeDate.getTime() === currentMonth.getTime()) {

        if (isPaid)
            status = "at_day";

        else if (today.getDate() <= params.deadline)
            status = "waiting";

        else
            status = "overdue";

    } else {

        status = isPaid
            ? "at_day"
            : "overdue";
    }

    return {
        status,
        isCurrent:
            feeDate.getTime() === currentMonth.getTime(),
        isPaid
    };
};

const enrichFee = (fee, student, params, today = new Date()) => {

    const info = computeStatus(params, fee, today);

    return {
        ...fee,

        amount: student?.classe?.grade?.monthly_fee ?? 0,

        status: info.status,
        isCurrent: info.isCurrent,
        isPaid: info.isPaid,
    };
};

module.exports = {
    createStats,
    getParams,
    getSchoolDate,
    getScopedStudents,
    computeStatus,
    enrichFee
};