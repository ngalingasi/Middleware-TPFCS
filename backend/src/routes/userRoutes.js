// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ User routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/', authenticate, authorize('ADMIN'), userController.getUsers);

router.get('/:id', authenticate, userController.getUserById);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('role').optional().isIn(['ADMIN', 'USER', 'VIEWER']).withMessage('Invalid role'),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']).withMessage('Invalid status')
  ],
  userController.updateUser
);

router.delete('/:id', authenticate, authorize('ADMIN'), userController.deleteUser);

router.post(
  '/:id/reset-password',
  authenticate,
  authorize('ADMIN'),
  [body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  userController.resetPassword
);

router.get('/:id/sessions', authenticate, userController.getUserSessions);

module.exports = router;
