const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcementController');
const auth = require('../middlewars/auth');

router.use(auth);
router.get('/', controller.getAnnouncements);
router.get('/:id', controller.getAnnouncementById);
router.post('/', controller.createAnnouncement);
router.patch('/:id', controller.updateAnnouncement);
router.delete('/:id', controller.deleteAnnouncement);

module.exports = router;
