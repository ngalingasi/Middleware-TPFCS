const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

/**
 * @route   POST /api/payments/webhook/notification
 * @desc    Receive payment notification from GePG (pmtSpNtfReq). v5 merged
 *          the old separate online/offline notifications into this one
 *          flow, so the previous online-notification route is gone.
 * @access  Public (GePG) - message is verified via digital signature
 */
router.post('/webhook/notification', paymentController.handlePaymentNotification);

/**
 * @route   GET /api/payments
 * @desc    Get all payments with pagination
 * @access  Public
 */
router.get('/', paymentController.getPayments);

/**
 * @route   GET /api/payments/statistics/summary
 * @desc    Get payment statistics
 * @access  Public
 */
router.get('/statistics/summary', paymentController.getPaymentStatistics);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get payment by ID
 * @access  Public
 */
router.get('/:paymentId', paymentController.getPaymentById);

module.exports = router;
