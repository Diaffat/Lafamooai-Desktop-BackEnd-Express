const prisma = require('../prisma');
const pageLimit = parseInt(process.env.pageLimit, 10);

// List all appointments
exports.listAppointments = async (req, res) => {
  try {
    const page = parseInt(req.query.page, pageLimit) || 1;
    const limit = parseInt(req.query.limit, pageLimit) || pageLimit;

    const total = await prisma.appointment.count();
    const appointments = await prisma.appointment.findMany({
      include: { enrollment: true },
      orderBy: { date_appoint: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({ count: total, results: appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Book appointment
exports.bookAppointment = async (req, res) => {
  try {
    const { enrollment_id, date_appoint, shift } = req.body;

    if (!enrollment_id || !date_appoint || !shift) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        enrollmentId: parseInt(enrollment_id, 10),
        date_appoint: new Date(date_appoint),
        shift: shift,
        status: 'confirmed'
      },
      include: { enrollment: true }
    });

    res.status(201).json({
      message: 'Rendez-vous confirmé',
      data: appointment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get appointment details
exports.getAppointmentDetails = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id_appointment: id },
      include: { enrollment: true }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    res.json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get payment page
exports.getPaymentPage = async (req, res) => {
  try {
    const { enrollment_id } = req.body;

    if (!enrollment_id) {
      return res.status(400).json({ error: 'enrollment_id is required' });
    }

    const enrollment = await prisma.enrollement.findUnique({
      where: { id_enrollement: parseInt(enrollment_id, 10) }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({
      message: "Page de paiement pour l'inscription",
      enrollment: enrollment_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create payment (stub)
exports.createPayment = async (req, res) => {
  try {
    res.json({ message: 'Payment creation in progress' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Mark payment as successful
exports.paymentSuccess = async (req, res) => {
  try {
    const transactionId = req.params.transaction_id;

    // TODO: Update payment record
    res.json({ message: 'Paiement réussi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Mark payment as failed
exports.paymentFailed = async (req, res) => {
  try {
    const transactionId = req.params.transaction_id;

    // TODO: Update payment record
    res.json({ message: 'Paiement échoué' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
