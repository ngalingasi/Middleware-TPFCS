// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ API key routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const apiKeyController = require('../controllers/apiKeyController');

router.get('/', authenticate, authorize('ADMIN'), apiKeyController.getApiKeys);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  [body('name').notEmpty().withMessage('Key name is required'), body('billingSystemId').isInt().withMessage('Choose the billing system this key is for')],
  apiKeyController.createApiKey
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  [body('status').isIn(['ACTIVE', 'DISABLED'])],
  apiKeyController.setApiKeyStatus
);

router.patch('/:id/system', authenticate, authorize('ADMIN'), [body('billingSystemId').isInt()], apiKeyController.assignBillingSystem);

router.delete('/:id', authenticate, authorize('ADMIN'), apiKeyController.deleteApiKey);

module.exports = router;
