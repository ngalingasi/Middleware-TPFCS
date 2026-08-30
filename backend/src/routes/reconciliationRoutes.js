const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const reconciliationController = require('../controllers/reconciliationController');

/**
 * @route   POST /api/reconciliation/request
 * @desc    Submit a gepgSpReconcReq to GePG
 * @access  Public
 */
router.post(
  '/request',
  [
    body('transactionDate').isISO8601().withMessage('transactionDate must be YYYY-MM-DD'),
    body('reconciliationOption').optional().isIn([1, 2]).withMessage('reconciliationOption must be 1 or 2')
  ],
  reconciliationController.submitReconciliationRequest
);

/**
 * @route   POST /api/reconciliation/webhook/response
 * @desc    Receive gepgSpReconcResp - the asynchronous reconciliation
 *          result GePG sends after processing a request. Previously
 *          missing entirely, despite the DB schema already anticipating it.
 * @access  Public (GePG) - message is verified via digital signature
 */
router.post('/webhook/response', reconciliationController.handleReconciliationResponseWebhook);

/**
 * @route   GET /api/reconciliation
 * @desc    Get all reconciliation requests with pagination
 * @access  Public
 */
router.get('/', reconciliationController.getReconciliationRequests);

/**
 * @route   GET /api/reconciliation/:requestId
 * @desc    Get a reconciliation request with its transactions
 * @access  Public
 */
router.get('/:requestId', reconciliationController.getReconciliationRequestById);

module.exports = router;
