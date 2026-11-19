// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Logs controller
// └──────────────────────────────────────────────────────────────────────────┘

const ActivityLog = require('../models/ActivityLog');
const MessageLog = require('../models/MessageLog');
const db = require('../config/database');
const logRetention = require('../services/logRetention');

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
      endDate: req.query.endDate,
      q: req.query.q,
      ip: req.query.ip
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

const DIRECTIONS = ['CLIENT_IN', 'GEPG_OUT', 'GEPG_IN'];

async function getMessageLogs(req, res) {
  try {
    const direction = DIRECTIONS.includes(req.query.direction) ? req.query.direction : undefined;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filters = { direction };
    ['q', 'status', 'systemId', 'ack', 'ip', 'startDate', 'endDate'].forEach((k) => { filters[k] = req.query[k]; });
    const result = await MessageLog.findAll(page, limit, filters);
    res.json({ success: true, data: result.data, pagination: result.pagination, acks: await MessageLog.acks() });
  } catch (error) {
    console.error('Get message logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get message logs' });
  }
}

async function getMessageLogById(req, res) {
  try {
    const log = await MessageLog.findById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Get message log error:', error);
    res.status(500).json({ success: false, message: 'Failed to get message log' });
  }
}

// Sign-in history is read from the audit log: the auth calls are logged with the address and browser.
const AUTH_EVENTS = {
  'validate-credentials': 'Password checked',
  'send-otp': 'Code requested',
  'verify-otp': 'Code entered (sign-in)',
  login: 'Sign-in with password',
  logout: 'Sign-out',
  'change-password': 'Password changed'
};
const AUTH_ACTIONS = Object.keys(AUTH_EVENTS).flatMap((name) => [`POST /api/auth/${name}`, `POST /${name}`]);

function browserOf(agent = '') {
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : agent ? 'Other' : '';
  const os = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Mac OS X/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' on ');
}

const parse = (text) => {
  try { return JSON.parse(text) || {}; } catch (e) { return {}; }
};

async function getLogins(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const result = await ActivityLog.findAll(page, limit, {
      actions: AUTH_ACTIONS,
      status: req.query.status,
      q: req.query.q,
      ip: req.query.ip,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });
    const data = await Promise.all(result.data.map(async (row) => {
      const full = await ActivityLog.findById(row.id);
      const body = parse(full.request_data);
      const answer = parse(full.response_data);
      const name = row.action.replace(/^POST (\/api\/auth)?\//, '');
      return {
        id: row.id,
        created_at: row.created_at,
        event: AUTH_EVENTS[name] || row.action,
        ok: row.status === 'SUCCESS',
        username: row.username || body.username || body.login || body.email || (answer.data && answer.data.user && answer.data.user.username) || null,
        channel: body.channel || null,
        ip_address: row.ip_address,
        browser: browserOf(row.user_agent),
        reason: row.status === 'SUCCESS' ? null : (answer.message || (Array.isArray(answer.errors) ? 'Invalid input' : null))
      };
    }));
    res.json({ success: true, data, pagination: result.pagination });
  } catch (error) {
    console.error('Get logins error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sign-in history' });
  }
}

// Logins that have not expired. The token itself is never sent to the browser.
async function getSessions(req, res) {
  try {
    const current = (req.headers.authorization || '').substring(7);
    const [rows] = await db.query(
      `SELECT s.id, s.token, s.ip_address, s.user_agent, s.created_at, s.expires_at, u.username, u.full_name, u.role
         FROM user_sessions s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > NOW() ORDER BY s.created_at DESC`
    );
    res.json({
      success: true,
      data: rows.map(({ token, user_agent, ...row }) => ({ ...row, browser: browserOf(user_agent), current: token === current }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sessions' });
  }
}

async function endSession(req, res) {
  try {
    const current = (req.headers.authorization || '').substring(7);
    const [rows] = await db.query('SELECT token FROM user_sessions WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Session not found' });
    if (rows[0].token === current) return res.status(400).json({ success: false, message: 'That is your own session. Use Sign out instead.' });
    await db.query('DELETE FROM user_sessions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Session ended' });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ success: false, message: 'Failed to end the session' });
  }
}

async function getRetention(req, res) {
  try {
    res.json({ success: true, data: await logRetention.overview() });
  } catch (error) {
    console.error('Get retention error:', error);
    res.status(500).json({ success: false, message: 'Failed to read the log retention' });
  }
}

async function runRetention(req, res) {
  try {
    const removed = await logRetention.trim();
    res.json({ success: true, message: `Removed ${removed.messages} message and ${removed.audit} audit rows`, data: { removed, overview: await logRetention.overview() } });
  } catch (error) {
    console.error('Run retention error:', error);
    res.status(500).json({ success: false, message: 'Clean-up failed' });
  }
}

async function getLogsStatistics(req, res) {
  try {
    const activity = await ActivityLog.getStatistics();

    res.json({
      success: true,
      data: {
        activityLogs: activity.activityStats,
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

module.exports = {
  getActivityLogs,
  getActivityLogById,
  getMessageLogs,
  getMessageLogById,
  getLogins,
  getSessions,
  endSession,
  getRetention,
  runRetention,
  getLogsStatistics,
  cleanupActivityLogs
};
