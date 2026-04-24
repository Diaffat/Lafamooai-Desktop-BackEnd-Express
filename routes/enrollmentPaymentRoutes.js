const express = require('express');
const router = express.Router();
const controller = require('../controllers/enrollmentPaymentController');
const auth = require('../middlewars/auth');

// GET /enrollment-payments/appointments - List appointments
router.get('/appointments', auth, controller.listAppointments);

// POST /enrollment-payments/book-appointment - Book appointment
router.post('/book-appointment', auth, controller.bookAppointment);

// GET /enrollment-payments/appointment/:id - Get appointment details
router.get('/appointment/:id', auth, controller.getAppointmentDetails);

// POST /enrollment-payments/payment-page - Get payment page
router.post('/payment-page', auth, controller.getPaymentPage);

// POST /enrollment-payments/create-payment - Create payment
router.post('/create-payment', auth, controller.createPayment);

// GET /enrollment-payments/success/:transaction_id - Payment success
router.get('/success/:transaction_id', auth, controller.paymentSuccess);

// GET /enrollment-payments/failed/:transaction_id - Payment failed
router.get('/failed/:transaction_id', auth, controller.paymentFailed);

module.exports = router;
