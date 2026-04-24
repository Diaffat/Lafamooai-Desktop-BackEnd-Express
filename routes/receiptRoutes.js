const express = require('express');
const router = express.Router();
//const auth = require('../middlewars/auth');
const controller = require('../controllers/receiptController');

//router.use(auth);
router.get('/', controller.getReceipts);
router.get('/:id/receipt_downloader', controller.downloadReceipt);

module.exports = router;
