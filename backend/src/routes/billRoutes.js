const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');

const billValidation = [
  body('billId').notEmpty().withMessage('Bill ID is required'),
  body('billAmount').isNumeric().withMessage('Bill amount must be numeric'),
  body('billExpiryDate').isISO8601().withMessage('Invalid expiry date format'),
  body('payerId').notEmpty().withMessage('Payer ID is required'),
  body('payerName').notEmpty().withMessage('Payer name is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one bill item is required')
];

/**
 * @route   POST /api/bills/create
 * @desc    Create a new bill
 * @access  Public
 */
router.post('/create', billValidation, billController.createBill);

/**
 * @route   POST /api/bills/submit/:billId
 * @desc    Submit bill to GePG
 * @access  Public
 */
router.post('/submit/:billId', billController.submitBill);

/**
 * @route   POST /api/bills/create-and-submit
 * @desc    Create and submit bill to GePG in one step
 * @access  Public
 */
router.post('/create-and-submit', billValidation, billController.createAndSubmit);

/**
 * @route   POST /api/bills/cancel/:billId
 * @desc    Cancel a bill
 * @access  Public
 */
router.post(
  '/cancel/:billId',
  [body('reason').notEmpty().withMessage('Cancellation reason is required')],
  billController.cancelBill
);

/**
 * @route   POST /api/bills/webhook/response
 * @desc    Receive gepgBillSubResp - the asynchronous bill processing
 *          result GePG sends after a submission. Previously missing.
 * @access  Public (GePG) - message is verified via digital signature
 */
router.post('/webhook/response', billController.handleBillResponseWebhook);

/**
 * @route   GET /api/bills
 * @desc    Get all bills with pagination
 * @access  Public
 */
router.get('/', billController.getBills);

/**
 * @route   GET /api/bills/:billId
 * @desc    Get bill by ID
 * @access  Public
 */
router.get('/:billId', billController.getBillById);

module.exports = router;
