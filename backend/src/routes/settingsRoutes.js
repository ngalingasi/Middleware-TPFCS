// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Settings routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

// dashboard login only: child systems (API keys) must not change settings
router.get('/environment', authenticate, settingsController.getEnvironment);

router.get('/', authenticate, authorize('ADMIN'), settingsController.getSettings);
router.put('/', authenticate, authorize('ADMIN'), settingsController.updateSettings);
router.get('/status', authenticate, authorize('ADMIN'), settingsController.getStatus);
router.post('/certificates/:kind', authenticate, authorize('ADMIN'), settingsController.uploadCertificate);
router.delete('/certificates/:kind', authenticate, authorize('ADMIN'), settingsController.removeCertificate);

module.exports = router;
