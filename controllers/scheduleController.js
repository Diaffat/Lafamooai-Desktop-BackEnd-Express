const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

// Get all schedules with filtering and pagination
exports.getSchedules = async (req, res) => {
  try {
    const { search, type, id } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const user = req.user;
    const where = {};
    let idInt = null;

    // Parse ID
    if (id && id !== 'NaN' && id !== '') {
      idInt = parseInt(id, 10);
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search } }
      ];
    }

    // Role-based filtering
    if (user.role === 'admin') {
      // Admin sees all
    } else if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id }
      });
      if (teacher) {
        where.subject = {
          teacherId: teacher.id_teacher
        };
      }
    } else if (user.role === 'student') {
      const student = await prisma.student.findFirst({
        where: { accountId: user.id }
      });
      if (student) {
        where.classe = {
          id_class: student.classeId
        };
      }
    } else if (user.role === 'parent') {
      const students = await prisma.student.findMany({
        where: { 
          parent: {
            user: { id: user.id }
          }
        }
      });
      if (students.length > 0) {
        const classIds = [...new Set(students.map(s => s.classeId).filter(Boolean))];
        where.classeId = { in: classIds };
      } else {
        where.id_schedule = { in: [] };
      }
    }

    // Type-based filter
    if (type && idInt) {
      if (type === 'teacherId') {
        where.subject = { teacher: { id_teacher: idInt } };
      } else if (type === 'classId') {
        where.classe = { id_class: idInt };
      } else if (type === 'studentId') {
        where.classe = {
          students: { some: { id_student: idInt } }
        };
      }
    }

    const total = await prisma.schedule.count({ where });
    const schedules = await prisma.schedule.findMany({
      where,
      include: { 
        subject: { include: { teacher: true } },
        classe: true,
        assignments: true 
      },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({ count: total, results: schedules });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get schedule by ID
exports.getScheduleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id_schedule: id },
      include: { 
        subject: { include: { teacher: true } },
        classe: true,
        assignments: true,
        attendances: true
      }
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create schedule
exports.createSchedule = async (req, res) => {
  try {
    const { 
      day_of_week, 
      date, 
      start_time, 
      end_time, 
      subjectId, 
      classeId 
    } = req.body;

    const schedule = await prisma.schedule.create({
      data: {
        day_of_week,
        ...(date && { date: new Date(date) }),
        ...(start_time && { start_time: new Date(start_time) }),
        ...(end_time && { end_time: new Date(end_time) }),
        ...(subjectId && { subjectId: parseInt(subjectId, 10) }),
        ...(classeId && { classeId: parseInt(classeId, 10) })
      },
      include: { 
        subject: { include: { teacher: true } },
        classe: true
      }
    });

    res.status(201).json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update schedule
exports.updateSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    const { 
      day_of_week, 
      date, 
      start_time, 
      end_time, 
      subjectId, 
      classeId 
    } = req.body;

    const schedule = await prisma.schedule.update({
      where: { id_schedule: id },
      data: {
        ...(day_of_week && { day_of_week }),
        ...(date && { date: new Date(date) }),
        ...(start_time && { start_time: new Date(start_time) }),
        ...(end_time && { end_time: new Date(end_time) }),
        ...(subjectId && { subjectId: parseInt(subjectId, 10) }),
        ...(classeId && { classeId: parseInt(classeId, 10) })
      },
      include: { 
        subject: { include: { teacher: true } },
        classe: true
      }
    });

    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete schedule
exports.deleteSchedule = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid schedule id' });
    }

    await prisma.schedule.delete({
      where: { id_schedule: id }
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Initialize attendance for a schedule
exports.initAttendance = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;

    if (!classId && !teacherId) {
      return res.status(400).json({ error: 'classId or teacherId is required' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let schedules = [];

    if (classId && teacherId) {
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();

      schedules = await prisma.schedule.findMany({
        where: {
          classeId: parseInt(classId, 10),
          subject: {
            teacher: {
              user: { id: parseInt(teacherId, 10) }
            }
          }
        },
        include: { 
          classe: { include: { students: true } },
          subject: true
        }
      });

      // Filter by time if start_time exists
      schedules = schedules.filter(schedule => {
        if (!schedule.start_time) return true;
        const scheduleTime = new Date(schedule.start_time);
        const scheduleHour = scheduleTime.getHours();
        const scheduleMinute = scheduleTime.getMinutes();
        return scheduleHour <= currentHour;
      });
    } else if (classId) {
      schedules = await prisma.schedule.findMany({
        where: {
          classeId: parseInt(classId, 10)
        },
        include: { 
          classe: { include: { students: true } },
          subject: true
        }
      });
    } else if (teacherId) {
      schedules = await prisma.schedule.findMany({
        where: {
          subject: {
            teacher: {
              user: { id: parseInt(teacherId, 10) }
            }
          }
        },
        include: { 
          classe: { include: { students: true } },
          subject: true
        }
      });
    }

    const attendances = [];

    for (const schedule of schedules) {
      if (schedule.classe && schedule.classe.students) {
        for (const student of schedule.classe.students) {
          const existingAttendance = await prisma.attendance.findFirst({
            where: {
              scheduleId: schedule.id_schedule,
              studentId: student.id_student,
              created_at: {
                gte: today,
                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
              }
            }
          });

          if (!existingAttendance) {
            const attendance = await prisma.attendance.create({
              data: {
                scheduleId: schedule.id_schedule,
                studentId: student.id_student,
                created_at: new Date(),
                status: 'present'
              },
              include: { student: true, schedule: true }
            });
            attendances.push(attendance);
          } else {
            attendances.push(existingAttendance);
          }
        }
      }
    }

    console.log('classId:', classId, 'teacherId:', teacherId);
    console.log('schedules:', schedules.length);

    res.json({ count: attendances.length, results: attendances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
