const prisma = require("./prisma");

async function fix() {
  try {
    console.log("🚀 Fixing class school years...");

    const result = await prisma.class.updateMany({
      where: {
        annee_academique: "2026-2027",
      },
      data: {
        annee_academique: "2025-2026",
      },
    });

    console.log("✅ Classes updated:", result.count);

    const students = await prisma.student.updateMany({
      where: {
        classe: {
          annee_academique: "2026-2027",
        },
      },
      data: {},
    });

    console.log("👨‍🎓 Students checked:", students.count);

    console.log("🎯 DONE FIX YEARS");

  } catch (err) {
    console.error("❌ ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}

fix();