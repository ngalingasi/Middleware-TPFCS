// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Log service: raw messages and audit entries to the database
// └──────────────────────────────────────────────────────────────────────────┘

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const MAX_BYTES = 2 * 1024 * 1024;

const SECRET_HEADERS = ['x-api-key', 'authorization', 'cookie', 'proxy-authorization'];

let dirReady = false;

function limit(text) {
  if (text === undefined || text === null) return { text: null, truncated: false };
  const value = typeof text === 'string' ? text : JSON.stringify(text);
  return value.length > MAX_BYTES
    ? { text: value.slice(0, MAX_BYTES), truncated: true }
    : { text: value, truncated: false };
}

function safeHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers || {})) {
    out[name] = SECRET_HEADERS.includes(name.toLowerCase()) ? '***REDACTED***' : value;
  }
  return out;
}

// One JSON line per entry, one file per day. The application only ever appends:
// keeping or archiving these files is up to the server, not to this code.
function appendFile(stream, entry) {
  try {
    if (!dirReady) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      dirReady = true;
    }
    const day = new Date().toLocaleDateString('en-CA');
    fs.appendFile(path.join(LOG_DIR, `${stream}-${day}.jsonl`), JSON.stringify(entry) + '\n', (error) => {
      if (error) console.error('Log file write failed:', error.message);
    });
  } catch (error) {
    console.error('Log file write failed:', error.message);
  }
}

// Never throws and never makes the caller wait: a logging problem must not break a request.
function message(entry) {
  const request = limit(entry.requestBody);
  const response = limit(entry.responseBody);
  const row = {
    direction: entry.direction,
    operation: entry.operation || null,
    billing_system_id: entry.billingSystemId || null,
    billing_system_code: entry.billingSystemCode || null,
    bill_id: entry.billId ? String(entry.billId).slice(0, 100) : null,
    reference: entry.reference ? String(entry.reference).slice(0, 191) : null,
    method: entry.method || null,
    url: entry.url ? String(entry.url).slice(0, 500) : null,
    ip_address: entry.ip || null,
    forwarded_for: entry.forwardedFor || null,
    user_agent: entry.userAgent ? String(entry.userAgent).slice(0, 500) : null,
    request_headers: entry.requestHeaders ? JSON.stringify(safeHeaders(entry.requestHeaders)) : null,
    request_body: request.text,
    status_code: entry.statusCode || null,
    response_body: response.text,
    ack_code: entry.ackCode || null,
    ok: entry.ok ? 1 : 0,
    error: entry.error ? String(entry.error).slice(0, 500) : null,
    duration_ms: entry.durationMs === undefined ? null : Math.round(entry.durationMs),
    truncated: request.truncated || response.truncated ? 1 : 0
  };

  // Local files are switched off for now. To keep a copy on disk as well, uncomment this line
  // (and the one in audit()); nothing deletes those files, so they would need archiving.
  // appendFile('messages', { at: new Date().toISOString(), ...row });

  const columns = Object.keys(row);
  db.query(`INSERT INTO message_logs (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, columns.map((c) => row[c]))
    .catch((error) => {
      if (error.code !== 'ER_NO_SUCH_TABLE') console.error('Message log failed:', error.message);
    });
}

function audit(row) {
  // appendFile('audit', { at: new Date().toISOString(), ...row });  // local copy, switched off for now
}

module.exports = { message, audit, safeHeaders, LOG_DIR };
