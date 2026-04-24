const prisma = require('../prisma');

const buildBaseWhere = (search, idAnnouncement) => {
  const where = {};
  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (idAnnouncement) {
    const id = parseInt(idAnnouncement, 10);
    if (!Number.isNaN(id)) {
      where.id_announcement = id;
    }
  }
  return where;
};

exports.getAnnouncements = async (req, res) => {
  try {
    const user = req.user || {};
    const { search = '', id_announcement } = req.query;
    const where = buildBaseWhere(search, id_announcement);

    if (user.role === 'admin') {
      const announcements = await prisma.announcement.findMany({
        ...(search || id_announcement ? { where } : {}),
        include: { classes: true },
        orderBy: { date_posted: 'desc' },
      });

      return res.json({ count: announcements.length, results: announcements });
    }
    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findFirst({ where: { userId: user.userId } });
      if (!teacher) {
        return res.json({ count: 0, results: [] });
      }

      const announcements = await prisma.announcement.findMany({
        where: {
          ...where,
          classes: {
            some: {
              subjects: {
                some: {
                  teacherId: teacher.id_teacher,
                },
              },
            },
          },
        },
        include: { classes: true },
        orderBy: { date_posted: 'desc' },
      });

      return res.json({ count: announcements.length, results: announcements });
    }

    if (user.role === 'student') {
      const student = await prisma.student.findFirst({ where: { accountId: user.userId } });
      if (!student) {
        const announcements = await prisma.announcement.findMany({
          where: { ...where, classes: { none: {} } },
          include: { classes: true },
          orderBy: { date_posted: 'desc' },
        });
        return res.json({ count: announcements.length, results: announcements });
      }

      const announcements = await prisma.announcement.findMany({
        where: {
          ...where,
          OR: [
            { classes: { some: { students: { some: { id_student: student.id_student } } } } },
            { classes: { none: {} } },
          ],
        },
        include: { classes: true },
        orderBy: { date_posted: 'desc' },
      });

      return res.json({ count: announcements.length, results: announcements });
    }

    if (user.role === 'parent') {
      const parent = await prisma.parent.findFirst({ where: { userId: user.userId } });
      if (!parent) {
        const announcements = await prisma.announcement.findMany({
          where: { ...where, classes: { none: {} } },
          include: { classes: true },
          orderBy: { date_posted: 'desc' },
        });
        return res.json({ count: announcements.length, results: announcements });
      }

      const studentIds = await prisma.student.findMany({
        where: { parentId: parent.id_parent },
        select: { id_student: true },
      });

      const ids = studentIds.map((s) => s.id_student);
      const announcements = await prisma.announcement.findMany({
        where: {
          ...where,
          OR: [
            { classes: { some: { students: { some: { id_student: { in: ids } } } } } },
            { classes: { none: {} } },
          ],
        },
        include: { classes: true },
        orderBy: { date_posted: 'desc' },
      });

      return res.json({ count: announcements.length, results: announcements });
    }

    const announcements = await prisma.announcement.findMany({
      where: { ...where, classes: { none: {} } },
      include: { classes: true },
      orderBy: { date_posted: 'desc' },
    });
    return res.json({ count: announcements.length, results: announcements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAnnouncementById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id_announcement: id },
      include: { classes: true },
    });
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, classIds, classes } = req.body;

    const ids = classIds || classes;
    if (!ids) {
      console.warn("⚠️ Aucun classIds reçu !");
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        classes: ids ? {
          connect: ids.map((id) => ({ id_class: parseInt(id, 10) })),
        } : undefined,
      },
      include: { classes: true },
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateAnnouncement = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  try {
    const { title, content, classes } = req.body;
    const data = {
      title,
      content,
    };

    if (classes) {
      data.classes = {
        set: classes.map((classId) => ({ id_class: parseInt(classId, 10) })),
      };
    }

    const announcement = await prisma.announcement.update({
      where: { id_announcement: id },
      data,
      include: { classes: true },
    });

    res.json(announcement);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid announcement id' });
  }

  try {
    await prisma.announcement.delete({ where: { id_announcement: id } });
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
