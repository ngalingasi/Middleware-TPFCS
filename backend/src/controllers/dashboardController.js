const Dashboard = require('../models/Dashboard');

async function getStatistics(req, res) {
  try {
    const bills = await Dashboard.getBillStats();
    const payments = await Dashboard.getPaymentStats();
    const recentPayments = await Dashboard.getRecentPayments(10);
    const monthlyTrend = await Dashboard.getMonthlyTrend();

    res.json({ success: true, data: { bills, payments, recentPayments, monthlyTrend } });
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getRecentActivities(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await Dashboard.getRecentActivities(limit);
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getPaymentChannels(req, res) {
  try {
    const data = await Dashboard.getPaymentChannelBreakdown();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Payment channels error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getDailySummary(req, res) {
  try {
    const data = await Dashboard.getDailySummary();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getTopPayers(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = await Dashboard.getTopPayers(limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Top payers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { getStatistics, getRecentActivities, getPaymentChannels, getDailySummary, getTopPayers };
