// controllers/user.controller.js
const prisma = require("../prisma");

const BASE_URL = 'http://localhost:8000';

// Utility function to build full image URL
const buildImageUrl = (user) => {
  if (user && user.img && !user.img.startsWith('http')) {
    return {
      ...user,
      img: `${BASE_URL}/media/${user.img}`
    };
  }
  return user;
};

// Apply to array of users
const buildImageUrls = (users) => {
  return Array.isArray(users) ? users.map(buildImageUrl) : buildImageUrl(users);
};

exports.getUsers = async (req, res) => {
  try {
    const { search, role, gender, class_id } = req.query;

    const where = {};

    // 🔎 Search
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } },
      ];
    }

    if (gender) {
      where.gender = gender;
    }

    if (role === "admin" || role === "teacher") {
      where.role = role;
    }

    if (role === "inactive") {
      where.isActive = false;
    }

    if (role === "student") {
      where.role = "student";
      if (class_id) {
        where.classId = parseInt(class_id);
      }
    }

    if (role === "boy") {
      where.role = "student";
      where.gender = "male";
      if (class_id) where.classId = parseInt(class_id);
    }

    if (role === "girl") {
      where.role = "student";
      where.gender = "female";
      if (class_id) where.classId = parseInt(class_id);
    }

    const users = await prisma.customUser.findMany({
      where,
      orderBy: [
        { username: "asc" }
      ],
    });

    res.json(buildImageUrls(users));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const formatPrismaError = (err, res) => {
  if (err?.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
    return res.status(400).json({ error: `Duplicate value for unique field(s): ${target}` });
  }

  console.error(err);
  return res.status(400).json({ error: 'Request failed', details: err });
};

exports.createUser = async (req, res) => {
  try {
    const user = await prisma.customUser.create({
      data: req.body,
    });

    res.status(201).json(buildImageUrl(user));

  } catch (err) {
    formatPrismaError(err, res);
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    // Build update data - filter out empty fields
    // Map frontend field names to Prisma schema field names
    const fieldMapping = {
      'name': null, // Not a direct field in schema
      'first_name': 'first_name',
      'last_name': 'last_name',
      'email': 'email',
      'phone': 'tel',
      'address': 'address',
      'gender': 'gender',
      'avatar': 'img',
      'bio': null // Not in schema
    };

    const updateData = {};
    
    for (const [bodyField, schemaField] of Object.entries(fieldMapping)) {
      if (schemaField && req.body[bodyField] !== undefined && req.body[bodyField] !== '') {
        updateData[schemaField] = req.body[bodyField];
      }
    }

    // Handle file upload if present (from multer.any())
    // Files are stored in req.files array, get the first one
    if (req.files && req.files.length > 0) {
      const uploadedFile = req.files[0];
      // Store with directory prefix for proper URL construction
      updateData.img = `users/${uploadedFile.filename}`;
    }

    // Check if there's data to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No data provided to update" });
    }

    const user = await prisma.customUser.update({
      where: { id: userId },
      data: updateData,
    });

    res.json(buildImageUrl(user));

  } catch (err) {
    formatPrismaError(err, res);
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const user = await prisma.customUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(buildImageUrl(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getStats = async (req, res) => {
  try {
    const raw_days = req.query.days || "7";
    const role = (req.query.role || "all").trim();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let days;
    try {
      days = parseInt(raw_days.replace(/\//g, '').trim());
    } catch (e) {
      days = 7;
    }

    const role_filter = role !== "all" ? { role } : {};

    const users = await prisma.customUser.findMany({
      where: role_filter,
      select: { createdAt: true, last_login: true }
    });

    const toDayKey = (date) => {
      if (!date) return null;
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const connexionsMap = new Map();
    const joinMap = new Map();

    users.forEach(user => {
      const joinDate = toDayKey(new Date(user.createdAt));
      joinMap.set(joinDate, (joinMap.get(joinDate) || 0) + 1);

      if (user.last_login) {
        const loginDate = toDayKey(new Date(user.last_login));
        connexionsMap.set(loginDate, (connexionsMap.get(loginDate) || 0) + 1);
      }
    });

    const traffics = [];
    let cumulativeUsers = 0;

    const startDate = days > 365
      ? (() => {
          if (users.length === 0) return today;
          const minJoin = users.reduce((min, u) => u.createdAt < min ? u.createdAt : min, users[0].createdAt);
          const result = new Date(minJoin);
          result.setHours(0, 0, 0, 0);
          return result;
        })()
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));

    let current = new Date(startDate);
    const endDate = new Date(today);

    while (current <= endDate) {
      const dayStr = toDayKey(current);
      const connexions = connexionsMap.get(dayStr) || 0;
      cumulativeUsers += joinMap.get(dayStr) || 0;

      traffics.push({
        name: current.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        date: dayStr,
        connexions,
        utilisateurs: cumulativeUsers
      });

      current.setDate(current.getDate() + 1);
    }

    res.json(traffics);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

exports.adminDash = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      date,
      days = "7",
      role = "all",
    } = req.query;

    const parsedDays = parseInt(days) || 7;

    // ================= USERS STATS (SCALABLE) =================
    const [
      total,
      admins,
      teachers,
      parents,
      studentsCount,
      inactive,
      male,
      female,
    ] = await Promise.all([
      prisma.customUser.count(),
      prisma.customUser.count({ where: { role: "admin" } }),
      prisma.customUser.count({ where: { role: "teacher" } }),
      prisma.customUser.count({ where: { role: "parent" } }),
      prisma.customUser.count({ where: { role: "student" } }),
      prisma.customUser.count({ where: { isActive: false } }),
      prisma.customUser.count({ where: { role: "student", gender: "male" } }),
      prisma.customUser.count({ where: { role: "student", gender: "female" } }),
    ]);

    const user_stats = {
      all: total,
      admin: admins,
      teacher: teachers,
      parent: parents,
      student: studentsCount,
      inactive,
    };

    const student_stats = {
      male,
      female,
    };

    // ================= ATTENDANCE =================
    const attendanceWhere = {};

    if (start_date && end_date) {
      attendanceWhere.created_at = {
        gte: new Date(start_date),
        lte: new Date(end_date),
      };
    }

    const attendances = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: {
        status: true,
        schedule: {
          select: { day_of_week: true },
        },
      },
    });

    const DAY_ORDER = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const DAY_MAP = {
      monday: "Lun",
      tuesday: "Mar",
      wednesday: "Mer",
      thursday: "Jeu",
      friday: "Ven",
      saturday: "Sam",
      sunday: "Dim",
    };

    const statsMap = {};

    for (const a of attendances) {
      const day = DAY_MAP[a.schedule?.dayOfWeek] || "Inconnu";

      if (!statsMap[day]) {
        statsMap[day] = { present: 0, absent: 0 };
      }

      if (a.status === "present") statsMap[day].present++;
      if (a.status === "absent") statsMap[day].absent++;
    }

    const formatted_stats = DAY_ORDER.map(day => ({
      day_of_week: day,
      present: statsMap[day]?.present || 0,
      absent: statsMap[day]?.absent || 0,
    }));

    // ================= TRAFFIC (SQL SAFE) =================
    let startDate, todayStr;

    // Utiliser start_date et end_date s'ils sont fournis, sinon utiliser parsedDays
    let endDate;
    if (start_date && end_date) {
      startDate = new Date(start_date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);
      todayStr = endDate.toISOString().slice(0, 10);
    } else {
      const today = new Date();
      startDate = new Date(today);
      startDate.setDate(today.getDate() - parsedDays + 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      todayStr = today.toISOString().slice(0, 10);
    }

    const startDateStr = startDate.getFullYear() + '-' + 
      String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(startDate.getDate()).padStart(2, '0');

    const todayStrLocal = endDate.getFullYear() + '-' + 
      String(endDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(endDate.getDate()).padStart(2, '0');

    const roleCondition = role !== "all" ? `AND role = '${role}'` : "";

    const logins = await prisma.$queryRawUnsafe(`
      SELECT strftime('%Y-%m-%d', last_login) as day, COUNT(*) as count
      FROM CustomUser
      WHERE last_login IS NOT NULL
        AND date(last_login) BETWEEN date('${startDateStr}') AND date('${todayStrLocal}')
        ${roleCondition}
      GROUP BY day
    `);

    const usersGrowth = await prisma.$queryRawUnsafe(`
      SELECT strftime('%Y-%m-%d', createdAt) as day, COUNT(*) as count
      FROM CustomUser
      WHERE date(createdAt) BETWEEN date('${startDateStr}') AND date('${todayStrLocal}')
        ${roleCondition}
      GROUP BY day
      ORDER BY day
    `);

    // Get total users created before the start date for cumulative calculation
    const usersBeforeStart = await prisma.customUser.count({
      where: {
        createdAt: { lt: startDate },
        ...(role !== "all" && { role })
      }
    });

    const loginMap = {};
    logins.forEach(l => (loginMap[l.day] = Number(l.count)));

    const userMap = {};
    usersGrowth.forEach(u => (userMap[u.day] = Number(u.count)));

    // Calculer le nombre de jours entre startDate et todayStr
    function diffDays(a, b) {
      const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
      const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
    }

    const daysDiff = diffDays(startDate, endDate);

    let traffics = [];
    let cumulative = usersBeforeStart;

    for (let i = 0; i < daysDiff; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);

      const key = current.getFullYear() + '-' + 
        String(current.getMonth() + 1).padStart(2, '0') + '-' + 
        String(current.getDate()).padStart(2, '0');

      cumulative += userMap[key] || 0;

      const dateParts = key.split('-');
      const name = dateParts[2] + ' ' + new Date(key + 'T00:00:00').toLocaleDateString("fr-FR", { month: "short" }) + ' ' + dateParts[0];

      traffics.push({
        name: name,
        date: key,
        connexions: loginMap[key] || 0,
        utilisateurs: cumulative,
      });
    }

    // ================= ANNOUNCEMENTS =================
    const announcements = await prisma.announcement.findMany();

    // ================= EVENTS =================
    let events = [];

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      events = await prisma.event.findMany({
        where: {
          startTime: { lt: end },
          endTime: { gte: start },
        },
      });
    }

    // ================= RESPONSE =================
    return res.json({
      results: {
        user_stats,
        student_stats,
        traffics,
        attendances: formatted_stats,
        announcements,
        events,
      },
      status: 200,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};