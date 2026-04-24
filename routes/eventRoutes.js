const express = require('express');
const router = express.Router();
const controller = require('../controllers/eventController');
const auth = require('../middlewars/auth');

router.use(auth);
router.get('/', controller.getEvents);
router.get('/:id', controller.getEventById);
router.post('/', controller.createEvent);
router.patch('/:id', controller.updateEvent);
router.delete('/:id', controller.deleteEvent);

module.exports = router;
