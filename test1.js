const prisma = require("./prisma");

async function run() {
  console.log("\n🚀 CLEAN DB DIAGNOSTIC START\n");

  const fees = await prisma.monthlyFeeDetails.findMany({
    include: {
      student: {
        include: {
          classe: {
            include: { grade: true },
          },
        },
      },
      receipt: true,
    },
  });

  console.log("📊 TOTAL FEES:", fees.length);

  if (!fees.length) return console.log("❌ DB EMPTY");

  // =========================
  // 1. SCHOOL YEAR ISSUE
  // =========================
  const mismatchedSchoolYear = fees.filter(
    f => f.school_years !== f.student?.classe?.annee_academique
  );

  console.log("\n🚨 SCHOOL YEAR MISMATCH:", mismatchedSchoolYear.length);

  if (mismatchedSchoolYear.length) {
    console.log("Example:");
    console.dir({
      fee: mismatchedSchoolYear[0].school_years,
      class: mismatchedSchoolYear[0].student?.classe?.annee_academique
    }, { depth: null });
  }

  // =========================
  // 2. MONTH TYPE CHECK
  // =========================
  const monthTypes = new Set(fees.map(f => typeof f.month));
  console.log("\n📅 MONTH TYPES:", [...monthTypes]);

  const badMonths = fees.filter(f => isNaN(Number(f.month)));
  console.log("🚨 INVALID MONTHS:", badMonths.length);

  // =========================
  // 3. PAYMENT CHECK
  // =========================
  let paid = 0;
  let unpaid = 0;

  fees.forEach(f => {
    if (f.receiptId || f.receipt) paid++;
    else unpaid++;
  });

  console.log("\n💰 PAID:", paid);
  console.log("❌ UNPAID:", unpaid);

  // =========================
  // 4. PRICE ISSUE (CRITICAL)
  // =========================
  const wrongPrice = fees.filter(f => {
    const expected = f.student?.classe?.grade?.monthly_fee;
    const actual = f.receipt?.total_amount;

    return f.receipt && expected && actual && expected !== actual;
  });

  console.log("\n💸 WRONG PRICE RECEIPTS:", wrongPrice.length);

  if (wrongPrice.length) {
    console.log("Example:");
    console.dir({
      expected: wrongPrice[0].student?.classe?.grade?.monthly_fee,
      actual: wrongPrice[0].receipt?.total_amount
    }, { depth: null });
  }

  // =========================
  // 5. FILTER SIMULATION (IMPORTANT)
  // =========================
  const currentYear = "2025-2026";

  const filtered = fees.filter(
    f => f.school_years === currentYear
  );

  console.log("\n🎯 FILTERED BY CURRENT YEAR:", filtered.length);

  const students = new Set(filtered.map(f => f.studentId));
  console.log("👨‍🎓 UNIQUE STUDENTS:", students.size);

  const statsCheck = {
    paid: filtered.filter(f => f.receiptId).length,
    unpaid: filtered.filter(f => !f.receiptId).length,
  };

  console.log("\n📊 BASIC STATS SIMULATION:", statsCheck);

  console.log("\n✅ CLEAN CHECK DONE\n");
}

run().catch(console.error);