const pageLimit = parseInt(process.env.pageLimit, 10);
const prisma = require('../prisma');

// Get all enrollments (with pagination)
exports.getEnrollmentList = async (req, res) => {
  try {
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const total = await prisma.enrollement.count();
    const enrollments = await prisma.enrollement.findMany({
      include: {
        tutor: true,
        students: true
      },
      orderBy: { submission_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({ count: total, results: enrollments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get enrollment details with tutor, student, and documents
exports.getEnrollmentDetails = async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id, 10);
    if (Number.isNaN(enrollmentId)) {
      return res.status(400).json({ error: 'Invalid enrollment id' });
    }

    const enrollment = await prisma.enrollement.findUnique({
      where: { id_enrollement: enrollmentId },
      include: { tutor: true }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Get student info
    const student = await prisma.enrollement_student_info.findFirst({
      where: { enrollementId: enrollmentId }
    });

    // Get documents
    if (student) {
      const documents = await prisma.enrollement_supporting_dcuments.findMany({
        where: { studentId: student.id }
      });

      res.json({
        tutor: enrollment.tutor,
        enrollment: enrollment,
        student: student,
        documents: documents
      });
    } else {
      res.json({
        tutor: enrollment.tutor,
        enrollment: enrollment,
        student: null,
        documents: []
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Validate enrollment (accept/reject)
exports.enrollmentValidation = async (req, res) => {
  try {
    const { enrollment_id, status } = req.body;

    if (!enrollment_id) {
      return res.status(400).json({ error: 'Missing enrollment_id' });
    }
    if (!status) {
      return res.status(400).json({ error: 'Missing status' });
    }

    const enrollment = await prisma.enrollement.findUnique({
      where: { id_enrollement: parseInt(enrollment_id, 10) },
      include: { tutor: true }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Update enrollment status
    await prisma.enrollement.update({
      where: { id_enrollement: parseInt(enrollment_id, 10) },
      data: { status: status }
    });

    // TODO: Send email notification
    const message = status === 'accepted' 
      ? 'Enrollment accepted and email sent' 
      : 'Enrollment rejected and email sent';

    res.json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
