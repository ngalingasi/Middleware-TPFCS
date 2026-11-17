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
const GfsCode = require('../models/GfsCode');

const billValidation = [
  body('billId').notEmpty().withMessage('Bill ID is required'),
  // SIT BP001_10: zero and negative bill amounts must be rejected as
  // invalid request data (GePG code 7242) - isNumeric alone let both through.
  body('billAmount').isFloat({ gt: 0 }).withMessage('Bill amount must be a number greater than zero'),
  body('items.*.billItemAmount').isFloat({ gt: 0 }).withMessage('Each bill item amount must be a number greater than zero'),
  body('billExpiryDate').isISO8601().withMessage('Invalid expiry date format'),
  body('payerId').notEmpty().withMessage('Payer ID is required'),
  body('payerName').notEmpty().withMessage('Payer name is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one bill item is required'),
  body('items').custom(async (items) => {
    if (!Array.isArray(items)) return true; // the isArray rule above already covers this case
    const submitted = [...new Set(items.map(i => i && i.gfsCode).filter(Boolean))];
    if (submitted.length === 0) return true;

    const valid = await GfsCode.findActiveCodesIn(submitted);
    const invalid = submitted.filter(c => !valid.includes(c));

    if (invalid.length > 0) {
      throw new Error(`Unknown or inactive GFS code(s): ${invalid.join(', ')}`);
    }
    return true;
  })
];

router.post('/create', authenticateAny, billValidation, billController.createBill);

router.post('/submit/:billId', authenticateAny, billController.submitBill);

router.post('/create-and-submit', authenticateAny, billValidation, billController.createAndSubmit);

router.post('/bulk', authenticateAny, billController.bulkCreateAndSubmit);

router.post(
  '/reuse',
  authenticateAny,
  billValidation,
  [
    body('paymentControlNumber').notEmpty().withMessage('paymentControlNumber is required for reuse'),
    body('reuseReason').trim().notEmpty().withMessage('reuseReason is required for reuse')
  ],
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
