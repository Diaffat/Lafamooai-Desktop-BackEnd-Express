const prisma = require("../prisma");

const modelsInDeleteOrder = [
  "assignmentSubmission",
  "assignmentResult",
  "examResultDetails",
  "examResult",
  "attendance",
  "schedule",
  "lesson",
  "assignment",
  "examStatis",
  "assignmentStatis",
  "reportConfig",
  "monthlyFeeStats",
  "receipt",
  "monthlyFeeDetails",
  "enrollementFeeDetails",
  "enrollement_supporting_dcuments",
  "event",
  "announcement",
  "exam",
  "subject",
  "class",
  "student",
  "parent",
  "teacher",
  "enrollement",
  "enrollement_student_info",
  "enrollement_tutor_info",
  "enrollementFee",
  "monthlyFeeParams",
  "paymentHistory",
  "paymentMethod",
  "verificationCode",
  "refreshToken",
  "message",
  "paymentType",
  "schoolInfos",
  "grade",
];

async function clearDatabaseExceptAdmin() {
  const firstAdminUser = await prisma.customUser.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });

  if (!firstAdminUser) {
    throw new Error("Aucun utilisateur admin trouvé dans la base de données.");
  }

  const preservedAdminUserId = firstAdminUser.id;
  const preservedAdmin = await prisma.admin.findFirst({
    where: { userId: preservedAdminUserId },
    orderBy: { id_admin: "asc" },
  });

  console.log("🔒 Préservation du premier administrateur :");
  console.log(`  - customUser.id = ${preservedAdminUserId}`);
  console.log(`  - admin.id_admin = ${preservedAdmin?.id_admin ?? "N/A"}`);

  for (const modelName of modelsInDeleteOrder) {
    if (typeof prisma[modelName] !== "object") {
      throw new Error(`Modèle Prisma introuvable : ${modelName}`);
    }

    const countBefore = await prisma[modelName].count();
    if (countBefore === 0) {
      console.log(`✅ ${modelName}: aucun enregistrement à supprimer`);
      continue;
    }

    console.log(
      `🧹 Suppression de ${countBefore} enregistrement(s) dans ${modelName}...`,
    );
    await prisma[modelName].deleteMany();
  }

  console.log("🧹 Suppression des administrateurs non conservés...");
  await prisma.admin.deleteMany({
    where: {
      userId: { not: preservedAdminUserId },
    },
  });

  console.log("🧹 Suppression des utilisateurs non conservés...");
  await prisma.customUser.deleteMany({
    where: {
      id: { not: preservedAdminUserId },
    },
  });

  console.log("🎉 Base de données vidée sauf le premier administrateur.");
}

clearDatabaseExceptAdmin()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ Erreur lors du vidage de la base :", error);
    await prisma.$disconnect();
    process.exit(1);
  });
