const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const reconciliationController = require('../controllers/reconciliationController');

/**
 * @route   POST /api/reconciliation/request
 * @desc    Submit a sucSpPmtReq to GePG
 * @access  Public
 */
router.post(
  '/request',
  [
    body('transactionDate').isISO8601().withMessage('transactionDate must be YYYY-MM-DD')
  ],
  reconciliationController.submitReconciliationRequest
);

/**
 * @route   POST /api/reconciliation/webhook/response
 * @desc    Receive sucSpPmtRes - the asynchronous reconciliation
 *          result GePG sends after processing a request.
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
