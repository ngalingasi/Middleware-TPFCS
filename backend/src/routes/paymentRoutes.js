const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

/**
 * @route   POST /api/payments/webhook/notification
 * @desc    Receive payment notification from GePG (gepgPmtSpInfo)
 * @access  Public (GePG) - message is verified via digital signature
 */
router.post('/webhook/notification', paymentController.handlePaymentNotification);

/**
 * @route   POST /api/payments/webhook/online-notification
 * @desc    Receive online payment notification from GePG (gepgOlPmtNtfSpInfo)
 * @access  Public (GePG) - message is verified via digital signature
 */
router.post('/webhook/online-notification', paymentController.handleOnlinePaymentNotification);

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
