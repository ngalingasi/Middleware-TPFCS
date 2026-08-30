const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const logsController = require('../controllers/logsController');

router.get('/activity', authenticate, authorize('ADMIN'), logsController.getActivityLogs);
router.get('/activity/:id', authenticate, authorize('ADMIN'), logsController.getActivityLogById);
router.get('/api', authenticate, authorize('ADMIN'), logsController.getApiLogs);
router.get('/statistics', authenticate, authorize('ADMIN'), logsController.getLogsStatistics);
router.delete('/activity/cleanup', authenticate, authorize('ADMIN'), logsController.cleanupActivityLogs);
router.delete('/api/cleanup', authenticate, authorize('ADMIN'), logsController.cleanupApiLogs);

module.exports = router;
