const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const apiKeyController = require('../controllers/apiKeyController');

// All API-key management is admin-only - these keys grant programmatic
// access to this bridge's own API, so issuing/revoking them is a
// privileged action, same tier as user management.
router.get('/', authenticate, authorize('ADMIN'), apiKeyController.getApiKeys);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  [body('name').notEmpty().withMessage('Key name is required')],
  apiKeyController.createApiKey
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN'),
  [body('status').isIn(['ACTIVE', 'DISABLED'])],
  apiKeyController.setApiKeyStatus
);

router.delete('/:id', authenticate, authorize('ADMIN'), apiKeyController.deleteApiKey);

module.exports = router;
