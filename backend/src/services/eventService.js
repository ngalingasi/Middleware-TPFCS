// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Event service: outbox, signed delivery to billing systems, retries
// └──────────────────────────────────────────────────────────────────────────┘

const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');
const BillingSystem = require('../models/BillingSystem');
const { EVENT_TYPES, BACKOFF_SECONDS, TIMEOUT_MS, sign } = require('../utils/webhookConfig');
const { envelope, billBlock, paymentBlock } = require('../utils/eventPayloads');

const LEASE_SECONDS = 120;
const WORKER_INTERVAL_MS = 5000;

async function totalsFor(exec, bill) {
  const [[row]] = await exec.query('SELECT COALESCE(SUM(paid_amount), 0) AS total FROM payments WHERE bill_id = ?', [bill.bill_id]);
  const billAmount = Number(bill.bill_amount);
  const totalPaid = Number(row.total);
  return { billAmount, totalPaid, remaining: Math.max(billAmount - totalPaid, 0), isPaid: totalPaid >= billAmount };
}

// `exec` is the pool or a transaction connection, so the event commits with the change that caused it
async function emitRaw(exec, system, type, billId, payload) {
  const push = !!system.callback_url;
  const [result] = await exec.query(
    `INSERT INTO outbound_events (billing_system_id, type, bill_id, payload, delivery_status, next_attempt_at, deadline_at)
     VALUES (?, ?, ?, ?, ?, IF(?, NOW(), NULL), IF(?, NOW() + INTERVAL ? HOUR, NULL))`,
    [system.id, type, billId, JSON.stringify(payload), push ? 'PENDING' : 'PULL_ONLY', push ? 1 : 0, push ? 1 : 0, system.retry_window_hours]
  );
  return result.insertId;
}

// returns null when the bill has no owner (dashboard-created bills send nothing)
async function emit(exec, bill, type, extra = {}) {
  if (!bill.billing_system_id) return null;
  const system = await BillingSystem.findById(bill.billing_system_id);
  if (!system) return null;
  return emitRaw(exec, system, type, bill.bill_id, { bill: billBlock(bill), ...extra });
}

async function post(row, url, secret, attempt) {
  const body = JSON.stringify(envelope(row));
  const timestamp = Math.floor(Date.now() / 1000);
  const started = Date.now();

  try {
    const res = await axios.post(url, body, {
      timeout: TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: 65536,
      validateStatus: () => true,
      transformRequest: [(d) => d],
      responseType: 'text',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GePG-Bridge/1.0',
        'X-Bridge-Event': row.type,
        'X-Bridge-Event-Id': String(row.id),
        'X-Bridge-Delivery-Attempt': String(attempt),
        'X-Bridge-Timestamp': String(timestamp),
        'X-Bridge-Signature': `t=${timestamp},v1=${sign(secret, timestamp, body)}`
      }
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      error: ok ? null : `HTTP ${res.status}`,
      snippet: typeof res.data === 'string' ? res.data.slice(0, 300) : '',
      ms: Date.now() - started
    };
  } catch (error) {
    return { ok: false, status: null, error: String(error.code || error.message).slice(0, 300), snippet: '', ms: Date.now() - started };
  }
}

async function attemptDelivery(row, system) {
  const attempt = row.attempts + 1;
  const secret = BillingSystem.secretOf(system);
  const result = await post(row, system.callback_url, secret, attempt);

  await db.query(
    `INSERT INTO event_deliveries (event_id, attempt, url, http_status, ok, error, response_snippet, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, attempt, system.callback_url, result.status, result.ok ? 1 : 0, result.error, result.snippet, result.ms]
  );

  if (result.ok) {
    await db.query(
      `UPDATE outbound_events SET delivery_status = 'DELIVERED', attempts = ?, delivered_at = NOW(), last_attempt_at = NOW(),
         last_http_status = ?, last_error = NULL, next_attempt_at = NULL WHERE id = ?`,
      [attempt, result.status, row.id]
    );
  } else {
    // the last attempt is made at the deadline itself, and when that fails the event is DEAD
    const delay = BACKOFF_SECONDS[Math.min(attempt - 1, BACKOFF_SECONDS.length - 1)];
    await db.query(
      `UPDATE outbound_events SET attempts = ?, last_attempt_at = NOW(), last_http_status = ?, last_error = ?,
         delivery_status = IF(NOW() >= deadline_at, 'DEAD', 'PENDING'),
         next_attempt_at = IF(NOW() >= deadline_at, NULL, LEAST(NOW() + INTERVAL ? SECOND, deadline_at))
       WHERE id = ?`,
      [attempt, result.status, result.error, delay, row.id]
    );
  }
  return result;
}

async function processDue(limit = 20) {
  // events for a system whose callback URL was removed become pull-only
  await db.query(
    `UPDATE outbound_events e JOIN billing_systems s ON s.id = e.billing_system_id
     SET e.delivery_status = 'PULL_ONLY', e.next_attempt_at = NULL
     WHERE e.delivery_status = 'PENDING' AND s.callback_url IS NULL`
  );

  const [rows] = await db.query(
    `SELECT e.* FROM outbound_events e JOIN billing_systems s ON s.id = e.billing_system_id
     WHERE e.delivery_status = 'PENDING' AND s.status = 'ACTIVE' AND s.callback_url IS NOT NULL AND e.next_attempt_at <= NOW()
     ORDER BY e.id LIMIT ?`,
    [limit]
  );

  let delivered = 0;
  for (const row of rows) {
    // claim it: only one worker (or instance) wins this update
    const [claim] = await db.query(
      `UPDATE outbound_events SET next_attempt_at = NOW() + INTERVAL ? SECOND
       WHERE id = ? AND delivery_status = 'PENDING' AND next_attempt_at <= NOW()`,
      [LEASE_SECONDS, row.id]
    );
    if (claim.affectedRows !== 1) continue;

    const system = await BillingSystem.findById(row.billing_system_id);
    const result = await attemptDelivery(row, system);
    if (result.ok) delivered++;
  }
  return { checked: rows.length, delivered };
}

function startWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processDue();
    } catch (error) {
      console.error('Event delivery error:', error.message);
    } finally {
      running = false;
    }
  }, WORKER_INTERVAL_MS);
  timer.unref();
}

// send a signed test event right now and report what the other side answered
async function sendTest(system) {
  if (!system.callback_url) {
    const error = new Error('Set a callback URL first');
    error.status = 400;
    throw error;
  }
  const id = await emitRaw(db, system, 'system.test', null, { message: 'Test event from the GePG bridge' });
  const [[row]] = await db.query('SELECT * FROM outbound_events WHERE id = ?', [id]);
  const result = await attemptDelivery(row, system);
  return { eventId: id, ok: result.ok, httpStatus: result.status, error: result.error, response: result.snippet, durationMs: result.ms };
}

// put an event back in the queue to be sent again now
async function replay(id) {
  const [[row]] = await db.query(
    `SELECT e.id, s.callback_url, s.retry_window_hours FROM outbound_events e
     JOIN billing_systems s ON s.id = e.billing_system_id WHERE e.id = ?`,
    [id]
  );
  if (!row) return { found: false };
  if (!row.callback_url) return { found: true, error: 'This billing system has no callback URL' };

  await db.query(
    `UPDATE outbound_events SET delivery_status = 'PENDING', next_attempt_at = NOW(), deadline_at = NOW() + INTERVAL ? HOUR,
       delivered_at = NULL WHERE id = ?`,
    [row.retry_window_hours, id]
  );
  return { found: true };
}

async function replayDead(systemId) {
  const [result] = await db.query(
    `UPDATE outbound_events e JOIN billing_systems s ON s.id = e.billing_system_id
     SET e.delivery_status = 'PENDING', e.next_attempt_at = NOW(), e.deadline_at = NOW() + INTERVAL s.retry_window_hours HOUR
     WHERE e.delivery_status = 'DEAD' AND s.callback_url IS NOT NULL AND e.billing_system_id = ?`,
    [systemId]
  );
  return result.affectedRows;
}

// events after a cursor, for systems that pull instead of (or as well as) receiving pushes
async function feed(systemId, after, limit) {
  const [rows] = await db.query(
    `SELECT * FROM outbound_events WHERE billing_system_id = ? AND id > ? AND type <> 'system.test' ORDER BY id LIMIT ?`,
    [systemId, after, limit]
  );
  return { events: rows.map(envelope), nextCursor: rows.length ? String(rows[rows.length - 1].id) : String(after) };
}

async function list({ systemId, status, type, billId, page = 1, limit = 25 }) {
  const where = [];
  const params = [];
  if (systemId) { where.push('e.billing_system_id = ?'); params.push(systemId); }
  if (status) { where.push('e.delivery_status = ?'); params.push(status); }
  if (type) { where.push('e.type = ?'); params.push(type); }
  if (billId) { where.push('e.bill_id LIKE ?'); params.push(`%${billId}%`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM outbound_events e ${clause}`, params);
  const [rows] = await db.query(
    `SELECT e.id, e.type, e.bill_id, e.delivery_status, e.attempts, e.next_attempt_at, e.deadline_at, e.last_attempt_at,
            e.last_http_status, e.last_error, e.delivered_at, e.created_at, s.code AS system_code, s.name AS system_name
     FROM outbound_events e JOIN billing_systems s ON s.id = e.billing_system_id
     ${clause} ORDER BY e.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return { data: rows, pagination: { page, limit, total: count.total, pages: Math.ceil(count.total / limit) } };
}

async function get(id) {
  const [[row]] = await db.query(
    `SELECT e.*, s.code AS system_code, s.name AS system_name, s.callback_url FROM outbound_events e
     JOIN billing_systems s ON s.id = e.billing_system_id WHERE e.id = ?`,
    [id]
  );
  if (!row) return null;
  const [deliveries] = await db.query('SELECT * FROM event_deliveries WHERE event_id = ? ORDER BY id', [id]);
  return { ...row, payload: JSON.parse(row.payload), envelope: envelope(row), deliveries };
}

async function stats() {
  const [rows] = await db.query(
    `SELECT delivery_status AS status, COUNT(*) AS n FROM outbound_events WHERE type <> 'system.test' GROUP BY delivery_status`
  );
  const counts = { PENDING: 0, DELIVERED: 0, DEAD: 0, PULL_ONLY: 0 };
  rows.forEach((r) => { counts[r.status] = r.n; });
  return counts;
}

module.exports = {
  EVENT_TYPES, BACKOFF_SECONDS, sign, envelope, billBlock, paymentBlock, totalsFor,
  emit, emitRaw, processDue, startWorker, sendTest, replay, replayDead, feed, list, get, stats
};
