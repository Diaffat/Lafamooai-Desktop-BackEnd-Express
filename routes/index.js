// express_backend_lafamooai/routes/index.js
const express = require('express');
const router = express.Router();
const licenseMiddleware = require("../middlewars/licenseMiddleware");

// imports
const studentRoutes = require('./studentRoutes');
const teacherRoutes = require('./teacherRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const monthlyFeeParamsRoutes = require('./monthlyFeeParamsRoutes');
const monthlyFeeDetailsRoutes = require('./monthlyFeeDetailsRoutes');
const enrollementFeeDetailsRoutes = require('./enrollementFeeDetailsRoutes');
const monthlyFeeStatsRoutes = require('./monthlyFeeStatsRoutes');
const receiptRoutes = require('./receiptRoutes');
//const paymentRoutes = require('./paymentRoutes');
const eventRoutes = require('./eventRoutes');

// routes DRF
router.use('/', authRoutes);

// =====================================
// PROTECTION LICENCE
// =====================================

router.use(licenseMiddleware);

router.use('/users', userRoutes);
router.use('/admins', adminRoutes);
router.use('/students', studentRoutes);
router.use('/parents', require('./parentRoutes'));
router.use('/teachers', teacherRoutes);
router.use('/classes', require('./classRoutes'));
router.use('/grades', require('./gradeRoutes'));
router.use('/school_infos', require('./schoolInfosRoutes'));
router.use('/monthlyfeeparams', monthlyFeeParamsRoutes);
router.use('/monthlyfeedetails', monthlyFeeDetailsRoutes);
router.use('/enrollement_fee_details', enrollementFeeDetailsRoutes);
router.use('/monthlyfeestats', monthlyFeeStatsRoutes);
router.use('/receipts', receiptRoutes);
router.use('/enrolements', require('./enrollementRoutes'));
router.use('/enrolement_students', require('./enrollementStudentRoutes'));
router.use('/supporting-documents', require('./supportingDocumentsRoutes'));
router.use('/enrollment-details', require('./enrollmentDetailsRoutes'));
router.use('/enrollment-payments', require('./enrollmentPaymentRoutes'));
router.use('/events', eventRoutes);

// Academic Routes
router.use('/exams', require('./examRoutes'));
router.use('/exam_results', require('./examResultRoutes'));
router.use('/assignments', require('./assignmentRoutes'));
router.use('/assignment_results', require('./assignmentResultRoutes'));
router.use('/schedules', require('./scheduleRoutes'));
router.use('/subjects', require('./subjectRoutes'));

/*router.use('/subjects', require('./subjectRoutes'));
router.use('/lessons', require('./lessonRoutes'));
//router.use('/attendances', require('./attendanceRoutes'));
//router.use('/receipts', require('./receiptRoutes'));


// routes custom
//router.use('/payments', paymentRoutes);
*/
const announcementRoutes = require('./announcementRoutes');
router.use('/announcements', announcementRoutes);

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

module.exports = router;
