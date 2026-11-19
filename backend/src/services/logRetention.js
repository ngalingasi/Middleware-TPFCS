// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Log retention: deletes database rows older than the days set on the Settings page
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const settings = require('./settingsService');

const DAY_MS = 24 * 60 * 60 * 1000;
// set on the Settings page (log_days_messages / log_days_audit); .env, then 90 and 365, otherwise
const days = (key, fallback) => {
  const value = Number(settings.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

async function trim() {
  const messages = days('log_days_messages', 90);
  const audit = days('log_days_audit', 365);
  const [m] = await db.query('DELETE FROM message_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [messages]);
  const [a] = await db.query('DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [audit]);
  if (m.affectedRows || a.affectedRows) {
    console.log(`Log retention: removed ${m.affectedRows} message and ${a.affectedRows} audit rows (older than ${messages} and ${audit} days)`);
  }
  return { messages: m.affectedRows, audit: a.affectedRows, messageDays: messages, auditDays: audit };
}

// for the Logs page: the days in force, what the database holds now and how far back it goes
async function overview() {
  const [[m]] = await db.query('SELECT COUNT(*) AS total, MIN(created_at) AS oldest FROM message_logs');
  const [[a]] = await db.query('SELECT COUNT(*) AS total, MIN(created_at) AS oldest FROM activity_logs');
  return {
    messages: { days: days('log_days_messages', 90), total: m.total, oldest: m.oldest },
    audit: { days: days('log_days_audit', 365), total: a.total, oldest: a.oldest }
  };
}

function startLogRetention() {
  const run = () => trim().catch((error) => console.error('Log retention failed:', error.message));
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, DAY_MS).unref();
}

module.exports = { startLogRetention, trim, overview };
