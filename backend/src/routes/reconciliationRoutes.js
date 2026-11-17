// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Reconciliation routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const reconciliationController = require('../controllers/reconciliationController');
const authenticateAny = require('../middleware/authenticateAny');

router.post(
  '/request',
  authenticateAny,
  [
    body('transactionDate').isISO8601().withMessage('transactionDate must be YYYY-MM-DD')
  ],
  reconciliationController.submitReconciliationRequest
);

router.post('/webhook/response', reconciliationController.handleReconciliationResponseWebhook);

router.get('/', authenticateAny, reconciliationController.getReconciliationRequests);

router.get('/:requestId', authenticateAny, reconciliationController.getReconciliationRequestById);

module.exports = router;
