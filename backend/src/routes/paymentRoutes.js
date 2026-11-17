// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Payment routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const printController = require('../controllers/printController');
const authenticateAny = require('../middleware/authenticateAny');

router.post('/webhook/notification', paymentController.handlePaymentNotification);

router.get('/', authenticateAny, paymentController.getPayments);

router.get('/statistics/summary', authenticateAny, paymentController.getPaymentStatistics);

router.get('/:paymentId/receipt', authenticateAny, printController.getReceiptData);

router.get('/:paymentId', authenticateAny, paymentController.getPaymentById);

module.exports = router;
