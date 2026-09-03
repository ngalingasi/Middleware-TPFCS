const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const authenticateAny = require('../middleware/authenticateAny');
const GfsCode = require('../models/GfsCode');

const billValidation = [
  body('billId').notEmpty().withMessage('Bill ID is required'),
  body('billAmount').isNumeric().withMessage('Bill amount must be numeric'),
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
 * @route   GET /api/bills/:billId/status
 * @desc    Lightweight paid/unpaid status check for the calling system to
 *          poll using the billId it originally submitted.
 * @access  Dashboard (JWT) or child system (X-Api-Key)
 */
router.get('/:billId/status', authenticateAny, billController.getBillStatus);

module.exports = router;
