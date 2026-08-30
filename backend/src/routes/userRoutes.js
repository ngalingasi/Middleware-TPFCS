const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

/**
 * @route   GET /api/users
 * @access  Private (Admin)
 */
router.get('/', authenticate, authorize('ADMIN'), userController.getUsers);

/**
 * @route   GET /api/users/:id
 * @access  Private (Admin or Self)
 */
router.get('/:id', authenticate, userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @access  Private (Admin)
 */
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

/**
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize('ADMIN'), userController.deleteUser);

/**
 * @route   POST /api/users/:id/reset-password
 * @access  Private (Admin)
 */
router.post(
  '/:id/reset-password',
  authenticate,
  authorize('ADMIN'),
  [body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  userController.resetPassword
);

/**
 * @route   GET /api/users/:id/sessions
 * @access  Private (Admin or Self)
 */
router.get('/:id/sessions', authenticate, userController.getUserSessions);

module.exports = router;
