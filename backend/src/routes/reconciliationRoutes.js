// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Reconciliation routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const reconciliationController = require('../controllers/reconciliationController');
const { authenticate } = require('../middleware/auth');

router.post(
  '/request',
  authenticate,
  [
    body('transactionDate').isISO8601().withMessage('transactionDate must be YYYY-MM-DD')
  ],
  reconciliationController.submitReconciliationRequest
);

router.post('/webhook/response', reconciliationController.handleReconciliationResponseWebhook);

router.get('/', authenticate, reconciliationController.getReconciliationRequests);

router.get('/:requestId', authenticate, reconciliationController.getReconciliationRequestById);

module.exports = router;
