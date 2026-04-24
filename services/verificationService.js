const prisma = require("../prisma");

const verifyCode = async (email, code) => {
  const verification = await prisma.verificationCode.findFirst({
    where: { email, code },
  });

  if (!verification) {
    throw new Error("INVALID_CODE");
  }

  const now = new Date();
  const createdAt = new Date(verification.date_created);
  const diffHours = (now - createdAt) / (1000 * 60 * 60);

  if (diffHours > 24) {
    throw new Error("EXPIRED_CODE");
  }

  // supprimer après validation
  await prisma.verificationCode.delete({
    where: { id: verification.id },
  });

  return true;
};

module.exports = { verifyCode };