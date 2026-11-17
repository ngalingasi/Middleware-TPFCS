// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Billing system model
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const secretBox = require('../services/secretBox');

// retry windows an admin can pick from (hours)
const RETRY_WINDOWS = [24, 48, 72, 168, 336];
const DEFAULT_RETRY_WINDOW = 72;

class BillingSystem {
  async create({ code, name, description, contact, callbackUrl, retryWindowHours, createdBy }) {
    const secret = secretBox.newSecret();
    const [result] = await db.query(
      `INSERT INTO billing_systems (code, name, description, contact, callback_url, webhook_secret, retry_window_hours, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, name, description || null, contact || null, callbackUrl || null, secretBox.encrypt(secret), retryWindowHours || DEFAULT_RETRY_WINDOW, createdBy]
    );
    return { id: result.insertId, secret };
  }

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM billing_systems WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async findByCode(code) {
    const [rows] = await db.query('SELECT * FROM billing_systems WHERE code = ?', [code]);
    return rows[0] || null;
  }

  // with counts, for the admin list
  async findAll() {
    const [rows] = await db.query(
      `SELECT s.id, s.code, s.name, s.description, s.contact, s.status, s.callback_url, s.retry_window_hours, s.created_at,
        (SELECT COUNT(*) FROM api_keys k WHERE k.billing_system_id = s.id AND k.status = 'ACTIVE') AS active_keys,
        (SELECT COUNT(*) FROM bills b WHERE b.billing_system_id = s.id) AS bill_count,
        (SELECT COUNT(*) FROM outbound_events e WHERE e.billing_system_id = s.id AND e.delivery_status = 'PENDING') AS pending_events,
        (SELECT COUNT(*) FROM outbound_events e WHERE e.billing_system_id = s.id AND e.delivery_status = 'DEAD') AS dead_events,
        (SELECT MAX(e.delivered_at) FROM outbound_events e WHERE e.billing_system_id = s.id) AS last_delivered_at
       FROM billing_systems s ORDER BY s.code`
    );
    return rows;
  }

  async update(id, { name, description, contact, callbackUrl, retryWindowHours, status }) {
    await db.query(
      `UPDATE billing_systems SET name = ?, description = ?, contact = ?, callback_url = ?, retry_window_hours = ?, status = ? WHERE id = ?`,
      [name, description || null, contact || null, callbackUrl || null, retryWindowHours, status, id]
    );
  }

  async rotateSecret(id) {
    const secret = secretBox.newSecret();
    await db.query('UPDATE billing_systems SET webhook_secret = ? WHERE id = ?', [secretBox.encrypt(secret), id]);
    return secret;
  }

  secretOf(system) {
    return system.webhook_secret ? secretBox.decrypt(system.webhook_secret) : null;
  }
}

module.exports = new BillingSystem();
module.exports.RETRY_WINDOWS = RETRY_WINDOWS;
module.exports.DEFAULT_RETRY_WINDOW = DEFAULT_RETRY_WINDOW;
