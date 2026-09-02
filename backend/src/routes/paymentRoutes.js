const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticateAny = require('../middleware/authenticateAny');

/**
 * @route   POST /api/payments/webhook/notification
 * @desc    Receive payment notification from GePG (pmtSpNtfReq). v5 merged
 *          the old separate online/offline notifications into this one
 *          flow, so the previous online-notification route is gone.
 * @access  Public (GePG) - message is verified via digital signature, not
 *          the dashboard/child-system schemes below.
 */
router.post('/webhook/notification', paymentController.handlePaymentNotification);

/**
 * @route   GET /api/payments
 * @desc    Get all payments with pagination
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/', authenticateAny, paymentController.getPayments);

/**
 * @route   GET /api/payments/statistics/summary
 * @desc    Get payment statistics
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/statistics/summary', authenticateAny, paymentController.getPaymentStatistics);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get payment by ID
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/:paymentId', authenticateAny, paymentController.getPaymentById);

module.exports = router;
