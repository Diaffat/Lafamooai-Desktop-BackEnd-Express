const prisma = require('./prisma');
(async () => {
  try {
    const grades = await prisma.grade.findMany({ orderBy: { id_grade: 'asc' } });
    const classes = await prisma.class.findMany({ include: { grade: true }, orderBy: { id_class: 'asc' } });
    const enrollments = await prisma.enrollement.findMany({
      where: { status: { in: ['Submitted', 'Accepted'] } },
      include: { students: { include: { demanded_class_level: true } } },
      orderBy: { id_enrollement: 'desc' },
      take: 10,
    });
    console.log(JSON.stringify({ grades, classes, enrollments }, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
