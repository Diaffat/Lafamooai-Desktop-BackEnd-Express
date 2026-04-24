const prisma = require('../prisma');
const pageLimit = parseInt(process.env.pageLimit, 10);

// Get all subjects with filtering and pagination
exports.getSubjects = async (req, res) => {
  try {
    const { search, classId } = req.query;
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const user = req.user;
    const where = {};

    // Search filter
    if (search) {
      where.name = { contains: search };
    }

    // Class filter
    if (classId && classId !== 'NaN' && classId !== '') {
      const parsedClassId = parseInt(classId, 10);
      if (!Number.isNaN(parsedClassId)) {
        where.classeId = parsedClassId;
      }
    }

    // Role-based filtering
    if (user.role === 'admin') {
      // Admin sees all
    } else if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id }
      });
      if (teacher) {
        where.teacherId = teacher.id_teacher;
      }
    }

    const total = await prisma.subject.count({ where });
    const subjects = await prisma.subject.findMany({
      where,
      include: { 
        teacher: true,
        classe: true,
        lessons: true
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({ count: total, results: subjects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get subject by ID
exports.getSubjectById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid subject id' });
    }

    const subject = await prisma.subject.findUnique({
      where: { id_subject: id },
      include: { 
        teacher: true,
        classe: true,
        lessons: true
      }
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    res.json(subject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create subject (standard CRUD)
exports.createSubject = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      coefficient, 
      score_scale, 
      secondary_note_percent,
      secondary_note,
      secondary_note_selection,
      classeId,
      teacherId
    } = req.body;

    const subject = await prisma.subject.create({
      data: {
        name,
        description,
        coefficient: coefficient ? parseInt(coefficient, 10) : 1,
        score_scale: score_scale ? parseInt(score_scale, 10) : null,
        secondary_note_percent: secondary_note_percent ? parseFloat(secondary_note_percent) : 0,
        secondary_note: secondary_note ? parseInt(secondary_note, 10) : 0,
        secondary_note_selection: secondary_note_selection ? parseInt(secondary_note_selection, 10) : 0,
        ...(classeId && { classeId: parseInt(classeId, 10) }),
        ...(teacherId && { teacherId: parseInt(teacherId, 10) })
      },
      include: { 
        teacher: true,
        classe: true
      }
    });

    res.status(201).json(subject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Register new subject (action custom)
exports.registerNew = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      coefficient, 
      score_scale, 
      secondary_note_percent,
      secondary_note,
      secondary_note_selection,
      classe_id,
      teacher_id
    } = req.body;

    if (!classe_id) {
      return res.status(400).json({ error: 'classe_id is required' });
    }

    // Verify class exists
    const classe = await prisma.class.findUnique({
      where: { id_class: parseInt(classe_id, 10) }
    });

    if (!classe) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get teacher
    let teacherId = null;
    if (teacher_id) {
      const parsedTeacherId = typeof teacher_id === 'object' 
        ? teacher_id.id_teacher 
        : parseInt(teacher_id, 10);
      
      const teacher = await prisma.teacher.findUnique({
        where: { id_teacher: parsedTeacherId }
      });
      
      if (teacher) {
        teacherId = teacher.id_teacher;
      }
    }

    // Create subject
    const newSubject = await prisma.subject.create({
      data: {
        name,
        description,
        coefficient: coefficient ? parseInt(coefficient, 10) : 1,
        score_scale: score_scale ? parseInt(score_scale, 10) : null,
        secondary_note_percent: secondary_note_percent ? parseFloat(secondary_note_percent) : 0,
        secondary_note: secondary_note ? parseInt(secondary_note, 10) : 0,
        secondary_note_selection: secondary_note_selection ? parseInt(secondary_note_selection, 10) : 0,
        classeId: parseInt(classe_id, 10),
        ...(teacherId && { teacherId })
      },
      include: { 
        teacher: true,
        classe: true
      }
    });

    res.status(201).json({
      message: 'Subject created successfully',
      results: newSubject
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update subject (standard CRUD)
exports.updateSubject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid subject id' });
    }

    const { 
      name, 
      description, 
      coefficient, 
      score_scale, 
      secondary_note_percent,
      secondary_note,
      secondary_note_selection,
      teacherId
    } = req.body;

    const subject = await prisma.subject.update({
      where: { id_subject: id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(coefficient && { coefficient: parseInt(coefficient, 10) }),
        ...(score_scale && { score_scale: parseInt(score_scale, 10) }),
        ...(secondary_note_percent !== undefined && { secondary_note_percent: parseFloat(secondary_note_percent) }),
        ...(secondary_note !== undefined && { secondary_note: parseInt(secondary_note, 10) }),
        ...(secondary_note_selection !== undefined && { secondary_note_selection: parseInt(secondary_note_selection, 10) }),
        ...(teacherId && { teacherId: parseInt(teacherId, 10) })
      },
      include: { 
        teacher: true,
        classe: true
      }
    });

    res.json(subject);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Custom update (action custom)
exports.customUpdate = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid subject id' });
    }

    const subject = await prisma.subject.findUnique({
      where: { id_subject: id },
      include: { teacher: true }
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Update fields if they differ from current values
    const updateData = {};

    if (req.body.name && subject.name !== req.body.name) {
      updateData.name = req.body.name;
    }

    if (req.body.description && subject.description !== req.body.description) {
      updateData.description = req.body.description;
    }

    if (req.body.coefficient && subject.coefficient !== parseInt(req.body.coefficient, 10)) {
      updateData.coefficient = parseInt(req.body.coefficient, 10);
    }

    if (req.body.score_scale && subject.score_scale !== parseInt(req.body.score_scale, 10)) {
      updateData.score_scale = parseInt(req.body.score_scale, 10);
    }

    if (req.body.secondary_note_percent !== undefined && subject.secondary_note_percent !== parseFloat(req.body.secondary_note_percent)) {
      updateData.secondary_note_percent = parseFloat(req.body.secondary_note_percent);
    }

    if (req.body.secondary_note !== undefined && subject.secondary_note !== parseInt(req.body.secondary_note, 10)) {
      updateData.secondary_note = parseInt(req.body.secondary_note, 10);
    }

    if (req.body.secondary_note_selection !== undefined && subject.secondary_note_selection !== parseInt(req.body.secondary_note_selection, 10)) {
      updateData.secondary_note_selection = parseInt(req.body.secondary_note_selection, 10);
    }

    // Update teacher if changed
    if (req.body.teachers && req.body.teachers.length > 0) {
      const newTeacherId = req.body.teachers[0].id_teacher;
      if (subject.teacher && subject.teacher.id_teacher !== newTeacherId) {
        updateData.teacherId = newTeacherId;
      }
    }

    // Only update if there are changes
    let updatedSubject = subject;
    if (Object.keys(updateData).length > 0) {
      updatedSubject = await prisma.subject.update({
        where: { id_subject: id },
        data: updateData,
        include: { 
          teacher: true,
          classe: true
        }
      });
    }

    res.json({
      message: 'Subject updated successfully',
      results: updatedSubject
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete subject
exports.deleteSubject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid subject id' });
    }

    await prisma.subject.delete({
      where: { id_subject: id }
    });

    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
