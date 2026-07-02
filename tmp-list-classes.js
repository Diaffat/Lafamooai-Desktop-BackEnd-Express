const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const classes = await prisma.class.findMany({
    select: {
      id_class: true,
      name: true,
      capacity: true,
      annee_academique: true,
    },
  });
  console.log(JSON.stringify(classes, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
