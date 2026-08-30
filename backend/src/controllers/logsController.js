const ActivityLog = require('../models/ActivityLog');
const ApiLog = require('../models/ApiLog');

async function getActivityLogs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = await ActivityLog.findAll(page, limit, {
      userId: req.query.userId,
      action: req.query.action,
      entityType: req.query.entityType,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get activity logs' });
  }
}

async function getActivityLogById(req, res) {
  try {
    const log = await ActivityLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ success: false, message: 'Failed to get activity log' });
  }
}

async function getApiLogs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = await ApiLog.findAll(page, limit, {
      endpoint: req.query.endpoint,
      method: req.query.method,
      statusCode: req.query.statusCode,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get API logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get API logs' });
  }
}

async function getLogsStatistics(req, res) {
  try {
    const activity = await ActivityLog.getStatistics();
    const apiStats = await ApiLog.getStatistics();

    res.json({
      success: true,
      data: {
        activityLogs: activity.activityStats,
        apiLogs: apiStats,
        topActions: activity.topActions,
        topUsers: activity.topUsers
      }
    });
  } catch (error) {
    console.error('Get logs statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to get logs statistics' });
  }
}

async function cleanupActivityLogs(req, res) {
  try {
    const days = parseInt(req.query.days) || 90;
    const deletedCount = await ActivityLog.cleanup(days);
    res.json({ success: true, message: `Cleaned up logs older than ${days} days`, deletedCount });
  } catch (error) {
    console.error('Cleanup logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup logs' });
  }
}

async function cleanupApiLogs(req, res) {
  try {
    const days = parseInt(req.query.days) || 90;
    const deletedCount = await ApiLog.cleanup(days);
    res.json({ success: true, message: `Cleaned up API logs older than ${days} days`, deletedCount });
  } catch (error) {
    console.error('Cleanup API logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup API logs' });
  }
}

module.exports = {
  getActivityLogs,
  getActivityLogById,
  getApiLogs,
  getLogsStatistics,
  cleanupActivityLogs,
  cleanupApiLogs
};
