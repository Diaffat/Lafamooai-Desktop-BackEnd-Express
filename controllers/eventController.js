const prisma = require('../prisma');

const buildBaseWhere = (search, dateString) => {
  const where = {};

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  if (dateString) {
    const date = new Date(dateString.replace('Z', '+00:00'));
    if (!Number.isNaN(date.getTime())) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.startTime = { lt: end };
      where.endTime = { gte: start };
    }
  }

  return where;
};

const eventInclude = {
  classes: true,
};

const serializeEvent = (event) => ({
  ...event,
  classes_name: (event?.classes ?? []).map((classe) => classe.name).filter(Boolean),
});

exports.getEvents = async (req, res) => {
  try {
    const user = req.user || {};
    const { search = '', date = '' } = req.query;
    const baseWhere = buildBaseWhere(search, date);

    if (user.role === 'admin') {
      const events = await prisma.event.findMany({
        where: baseWhere,
        include: eventInclude,
        orderBy: { startTime: 'desc' },
      });
      return res.json({ count: events.length, results: events.map(serializeEvent) });
    }

    if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findFirst({ where: { userId: user.userId } });
      if (!teacher) {
        return res.json({ count: 0, results: [] });
      }

      const events = await prisma.event.findMany({
        where: {
          ...baseWhere,
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
        include: eventInclude,
        orderBy: { startTime: 'desc' },
      });

      return res.json({ count: events.length, results: events.map(serializeEvent) });
    }

    if (user.role === 'student') {
      const student = await prisma.student.findFirst({ where: { accountId: user.userId } });
      const events = await prisma.event.findMany({
        where: {
          ...baseWhere,
          OR: [
            { classes: { some: { students: { some: { id_student: student?.id_student ?? -1 } } } } },
            { classes: { none: {} } },
          ],
        },
        include: eventInclude,
        orderBy: { startTime: 'desc' },
      });
      return res.json({ count: events.length, results: events.map(serializeEvent) });
    }

    if (user.role === 'parent') {
      const parent = await prisma.parent.findFirst({ where: { userId: user.userId } });
      if (!parent) {
        const events = await prisma.event.findMany({
          where: { ...baseWhere, classes: { none: {} } },
          include: eventInclude,
          orderBy: { startTime: 'desc' },
        });
        return res.json({ count: events.length, results: events.map(serializeEvent) });
      }

      const studentIds = await prisma.student.findMany({
        where: { parentId: parent.id_parent },
        select: { id_student: true },
      });

      const ids = studentIds.map((s) => s.id_student);
      const events = await prisma.event.findMany({
        where: {
          ...baseWhere,
          OR: [
            { classes: { some: { students: { some: { id_student: { in: ids } } } } } },
            { classes: { none: {} } },
          ],
        },
        include: eventInclude,
        orderBy: { startTime: 'desc' },
      });
      return res.json({ count: events.length, results: events.map(serializeEvent) });
    }

    const events = await prisma.event.findMany({
      where: { ...baseWhere, classes: { none: {} } },
      include: eventInclude,
      orderBy: { startTime: 'desc' },
    });
    return res.json({ count: events.length, results: events.map(serializeEvent) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getEventById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id_event: id },
      include: eventInclude,
    });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(serializeEvent(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, description, location, startTime, endTime, classIds } = req.body;
    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        classes: classIds
          ? {
              connect: classIds.map((id) => ({ id_class: parseInt(id, 10) })),
            }
          : undefined,
      },
      include: eventInclude,
    });
    res.status(201).json(serializeEvent(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateEvent = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  try {
    const { title, description, location, startTime, endTime, classIds } = req.body;
    const data = {
      title,
      description,
      location,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
    };

    if (classIds) {
      data.classes = { set: classIds.map((classId) => ({ id_class: parseInt(classId, 10) })) };
    }

    const event = await prisma.event.update({
      where: { id_event: id },
      data,
      include: eventInclude,
    });
    res.json(serializeEvent(event));
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteEvent = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  try {
    await prisma.event.delete({ where: { id_event: id } });
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
