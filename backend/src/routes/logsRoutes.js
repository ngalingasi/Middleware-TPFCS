// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Logs routes
// └──────────────────────────────────────────────────────────────────────────┘

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const logsController = require('../controllers/logsController');

router.get('/activity', authenticate, authorize('ADMIN'), logsController.getActivityLogs);
router.get('/activity/:id', authenticate, authorize('ADMIN'), logsController.getActivityLogById);
router.get('/messages', authenticate, authorize('ADMIN'), logsController.getMessageLogs);
router.get('/messages/:id', authenticate, authorize('ADMIN'), logsController.getMessageLogById);
router.get('/logins', authenticate, authorize('ADMIN'), logsController.getLogins);
router.get('/sessions', authenticate, authorize('ADMIN'), logsController.getSessions);
router.delete('/sessions/:id', authenticate, authorize('ADMIN'), logsController.endSession);
router.get('/retention', authenticate, authorize('ADMIN'), logsController.getRetention);
router.post('/retention/run', authenticate, authorize('ADMIN'), logsController.runRetention);
router.get('/statistics', authenticate, authorize('ADMIN'), logsController.getLogsStatistics);
router.delete('/activity/cleanup', authenticate, authorize('ADMIN'), logsController.cleanupActivityLogs);

module.exports = router;
