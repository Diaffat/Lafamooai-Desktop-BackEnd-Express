const prisma = require("./prisma");

const DRY_RUN = false; // 🔥 mets true pour tester sans modifier

async function cleanDB() {
  console.log("🚀 START CLEAN DB\n");
  console.log("MODE:", DRY_RUN ? "DRY RUN (no changes)" : "LIVE (writing DB)");
  console.log("=====================================\n");

  let fixedYears = 0;
  let fixedAmounts = 0;

  const fees = await prisma.monthlyFeeDetails.findMany({
    include: {
      student: {
        include: {
          classe: {
            include: {
              grade: true,
            },
          },
        },
      },
      receipt: true,
    },
  });

  console.log(`📊 Total records: ${fees.length}\n`);
  console.log('fees ', fees);

  for (const f of fees) {
    const classYear = f.student?.classe?.annee_academique;
    const expectedAmount =
      f.student?.classe?.grade?.monthly_fee ?? 0;

    // =========================
    // 1. FIX SCHOOL YEAR
    // =========================
    if (classYear && f.school_years !== classYear) {
      fixedYears++;

      console.log("🛠 FIX YEAR:", {
        id: f.id_mthl_fd,
        from: f.school_years,
        to: classYear,
      });

      if (!DRY_RUN) {
        await prisma.monthlyFeeDetails.update({
          where: { id_mthl_fd: f.id_mthl_fd },
          data: { school_years: classYear },
        });
      }
    }

    // =========================
    // 2. FIX RECEIPT AMOUNT
    // =========================
    if (f.receipt && f.receipt.total_amount !== expectedAmount) {
      fixedAmounts++;

      console.log("💸 FIX AMOUNT:", {
        receiptId: f.receipt.id_receipt,
        from: f.receipt.total_amount,
        to: expectedAmount,
      });

      if (!DRY_RUN) {
        await prisma.receipt.update({
          where: { id_receipt: f.receipt.id_receipt },
          data: { total_amount: expectedAmount },
        });
      }
    }
  }

  console.log("\n=====================================");
  console.log("✅ CLEAN COMPLETE\n");

  console.log("📊 SUMMARY:");
  console.log("Fixed school years:", fixedYears);
  console.log("Fixed receipt amounts:", fixedAmounts);

  console.log("\n=====================================");

  if (DRY_RUN) {
    console.log("⚠️ No changes applied (dry run mode)");
  } else {
    console.log("🔥 Database successfully cleaned");
  }
}

cleanDB()
  .catch((e) => {
    console.error("❌ ERROR:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });