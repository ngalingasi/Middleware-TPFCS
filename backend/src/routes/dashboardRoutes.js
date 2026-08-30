const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/statistics', dashboardController.getStatistics);
router.get('/recent-activities', dashboardController.getRecentActivities);
router.get('/payment-channels', dashboardController.getPaymentChannels);
router.get('/daily-summary', dashboardController.getDailySummary);
router.get('/top-payers', dashboardController.getTopPayers);

module.exports = router;
