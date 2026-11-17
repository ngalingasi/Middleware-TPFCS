// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Auth routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');
const otpAuthController = require('../controllers/otpAuthController');

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  authController.login
);

router.post('/logout', authenticate, authController.logout);

// OTP 2FA login (3-step flow) - alternative to plain /login above

router.post(
  '/validate-credentials',
  [
    body('login').notEmpty().withMessage('Username or email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  otpAuthController.validateCredentials
);

router.post(
  '/send-otp',
  [
    body('login').notEmpty().withMessage('Username or email is required'),
    body('channel').isIn(['email', 'sms']).withMessage('channel must be "email" or "sms"')
  ],
  otpAuthController.sendOtp
);

router.post(
  '/verify-otp',
  [
    body('login').notEmpty().withMessage('Username or email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric().withMessage('OTP must be numeric')
  ],
  otpAuthController.verifyOtp
);

router.get('/me', authenticate, authController.getCurrentUser);

router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  authController.changePassword
);

router.post(
  '/register',
  authenticate,
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('role').isIn(['ADMIN', 'USER', 'VIEWER']).withMessage('Invalid role')
  ],
  authController.register
);

module.exports = router;
