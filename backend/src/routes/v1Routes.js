// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ System-facing API, version 1
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { billValidation, reuseValidation } = require('../middleware/billValidation');
const billController = require('../controllers/billController');
const paymentController = require('../controllers/paymentController');
const printController = require('../controllers/printController');
const v1 = require('../controllers/v1Controller');

// billing systems only: an API key that belongs to an active billing system
router.use(apiKeyAuth);

router.get('/ping', v1.ping);
router.get('/events', v1.getEvents);

router.post('/bills', billValidation, billController.createAndSubmit);
router.post('/bills/bulk', billController.bulkCreateAndSubmit);
router.post('/bills/reuse', billValidation, reuseValidation, billController.reuseBill);
router.post('/bills/status', v1.getBillStatuses);
router.get('/bills', billController.getBills);
router.get('/bills/:billId', billController.getBillById);
router.get('/bills/:billId/status', billController.getBillStatus);
router.get('/bills/:billId/print', printController.getBillPrintData);
router.post('/bills/:billId/cancel', billController.cancelBill);
router.post('/bills/:billId/extend', billController.changeBillExpiry);

router.get('/payments', paymentController.getPayments);
router.get('/payments/:paymentId', paymentController.getPaymentById);
router.get('/payments/:paymentId/receipt', printController.getReceiptData);

module.exports = router;
