// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bill routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const printController = require('../controllers/printController');
const authenticateAny = require('../middleware/authenticateAny');
const { billValidation, reuseValidation } = require('../middleware/billValidation');

router.post('/create', authenticateAny, billValidation, billController.createBill);

router.post('/submit/:billId', authenticateAny, billController.submitBill);

router.post('/create-and-submit', authenticateAny, billValidation, billController.createAndSubmit);

router.post('/bulk', authenticateAny, billController.bulkCreateAndSubmit);

router.post(
  '/reuse',
  authenticateAny,
  billValidation,
  reuseValidation,
  billController.reuseBill
);

router.post('/change/:billId', authenticateAny, billController.changeBillExpiry);

router.post(
  '/cancel/:billId',
  authenticateAny,
  [body('reason').notEmpty().withMessage('Cancellation reason is required')],
  billController.cancelBill
);

router.post('/webhook/response', billController.handleBillResponseWebhook);

router.get('/', authenticateAny, billController.getBills);

router.get('/:billId', authenticateAny, billController.getBillById);

router.get('/:billId/print', authenticateAny, printController.getBillPrintData);

router.get('/:billId/status', authenticateAny, billController.getBillStatus);

module.exports = router;
