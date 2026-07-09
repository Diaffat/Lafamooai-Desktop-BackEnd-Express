const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
 const user = await prisma.customUser.findUnique({
  where: { id: 1 },
});

console.log(user?.img);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
