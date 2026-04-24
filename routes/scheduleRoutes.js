const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleController');
const auth = require('../middlewars/auth');

// GET /schedules - Get all schedules with filtering
router.get('/', auth, controller.getSchedules);

// POST /schedules/init-attendance - Initialize attendance
router.post('/init-attendance', auth, controller.initAttendance);

// GET /schedules/:id - Get schedule by ID
router.get('/:id', auth, controller.getScheduleById);

// POST /schedules - Create schedule
router.post('/', auth, controller.createSchedule);

// PATCH /schedules/:id - Update schedule
router.patch('/:id', auth, controller.updateSchedule);

// DELETE /schedules/:id - Delete schedule
router.delete('/:id', auth, controller.deleteSchedule);

module.exports = router;
