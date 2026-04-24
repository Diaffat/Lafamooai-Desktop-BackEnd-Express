// express_backend_lafamooai/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewars/auth');

const {
  login,
  logout,
  signup,
  requestVerification,
  createAndSendCode,
  refresh,
  resetPassword,
  resetPasswordConfirm,
  changePassword,
  getMe
} = require('../controllers/authController');

router.post('/login', login);
router.post('/logout', logout);
router.post('/request_code', requestVerification);
router.post('/create_and_send_code', auth, createAndSendCode); // New route for creating and sending verification code
router.post('/refresh', refresh);
router.get('/me', auth, getMe);

// Django: signup/<email>/<code>/<role>
router.post('/signup', signup); 
// (on passe en body → beaucoup mieux)

// Password Management Routes
router.post('/password_reset', resetPassword);
router.post('/password_reset_confirm', resetPasswordConfirm);
router.post('/change_password', auth, changePassword);

module.exports = router;