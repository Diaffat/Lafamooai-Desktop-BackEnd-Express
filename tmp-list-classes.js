const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
 const fees = await prisma.monthlyFeeParams.findMany();

console.log(fees);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
