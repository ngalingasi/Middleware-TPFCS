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
  // Single query regardless of item count - diffs submitted codes against
  // the ACTIVE master list (managed at /api/gfs-codes) rather than
  // accepting any free-text string. Applies equally to the dashboard form
  // and any child system calling this route directly.
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

/**
 * @route   POST /api/bills/create
 * @desc    Create a new bill
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.post('/create', authenticateAny, billValidation, billController.createBill);

/**
 * @route   POST /api/bills/submit/:billId
 * @desc    Submit bill to GePG
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.post('/submit/:billId', authenticateAny, billController.submitBill);

/**
 * @route   POST /api/bills/create-and-submit
 * @desc    Create and submit bill to GePG in one step
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.post('/create-and-submit', authenticateAny, billValidation, billController.createAndSubmit);

/**
 * @route   POST /api/bills/bulk
 * @desc    Create and submit many bills in one call ({ bills: [...] }, max
 *          100). Each bill is validated and sent independently; the response
 *          lists a result (and GePG code) per bill.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.post('/bulk', authenticateAny, billController.bulkCreateAndSubmit);

/**
 * @route   POST /api/bills/reuse
 * @desc    Reuse a control number GePG issued earlier (paid, expired or
 *          cancelled bill) for new bill details. Same payload as /create plus
 *          paymentControlNumber and reuseReason.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
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

/**
 * @route   POST /api/bills/change/:billId
 * @desc    Extend the expiry date of an existing approved bill; the control
 *          number is unchanged. Body: { billExpiryDate, reason }.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.post('/change/:billId', authenticateAny, billController.changeBillExpiry);

/**
 * @route   POST /api/bills/cancel/:billId
 * @desc    Cancel a bill
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.post(
  '/cancel/:billId',
  authenticateAny,
  [body('reason').notEmpty().withMessage('Cancellation reason is required')],
  billController.cancelBill
);

/**
 * @route   POST /api/bills/webhook/response
 * @desc    Receive billSubRes - the asynchronous bill processing
 *          result GePG sends after a submission.
 * @access  Public (GePG) - message is verified via digital signature, not
 *          the dashboard/child-system schemes above.
 */
router.post('/webhook/response', billController.handleBillResponseWebhook);

/**
 * @route   GET /api/bills
 * @desc    Get all bills with pagination
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/', authenticateAny, billController.getBills);

/**
 * @route   GET /api/bills/:billId
 * @desc    Get bill by ID, including its payment history
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/:billId', authenticateAny, billController.getBillById);

/**
 * @route   GET /api/bills/:billId/print
 * @desc    Data for the printable bill (?type=bill, default) or TISS/SWIFT
 *          transfer bill (?type=transfer). Only available once the bill has
 *          a control number.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/:billId/print', authenticateAny, printController.getBillPrintData);

/**
 * @route   GET /api/bills/:billId/status
 * @desc    Lightweight paid/unpaid status check for the calling system to
 *          poll using the billId it originally submitted.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/:billId/status', authenticateAny, billController.getBillStatus);

module.exports = router;
