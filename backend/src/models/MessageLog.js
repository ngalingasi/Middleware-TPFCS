// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 19/11/2026
// │ Message log model: raw messages between billing systems, the bridge and GePG
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');

const LIST_COLUMNS = `id, direction, operation, billing_system_id, billing_system_code, bill_id, reference, method, url,
  ip_address, status_code, ack_code, ok, error, duration_ms, truncated, created_at,
  LENGTH(request_body) AS request_size, LENGTH(response_body) AS response_size`;

class MessageLog {
  async findAll(page = 1, limit = 20, filters = {}) {
    const where = [];
    const params = [];

    if (filters.direction) {
      where.push('direction = ?');
      params.push(filters.direction);
    }
    if (filters.q) {
      where.push('(bill_id LIKE ? OR reference LIKE ? OR url LIKE ? OR operation LIKE ? OR error LIKE ?)');
      params.push(...Array(5).fill(`%${filters.q}%`));
    }
    if (filters.status === 'ok') where.push('ok = 1');
    if (filters.status === 'failed') where.push('ok = 0');
    if (filters.systemId) {
      where.push('billing_system_id = ?');
      params.push(filters.systemId);
    }
    if (filters.ack) {
      where.push('ack_code = ?');
      params.push(filters.ack);
    }
    if (filters.ip) {
      where.push('ip_address LIKE ?');
      params.push(`${filters.ip}%`);
    }
    if (filters.startDate) {
      where.push('created_at >= ?');
      params.push(`${filters.startDate} 00:00:00`);
    }
    if (filters.endDate) {
      where.push('created_at <= ?');
      params.push(`${filters.endDate} 23:59:59`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM message_logs ${clause}`, params);
    const [rows] = await db.query(
      `SELECT ${LIST_COLUMNS} FROM message_logs ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );

    return { data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM message_logs WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async acks() {
    const [rows] = await db.query("SELECT DISTINCT ack_code FROM message_logs WHERE direction = 'GEPG_IN' AND ack_code IS NOT NULL ORDER BY ack_code");
    return rows.map((r) => r.ack_code);
  }

  async summary() {
    const [[m]] = await db.query('SELECT COUNT(*) AS total, MIN(created_at) AS oldest FROM message_logs');
    return m;
  }
}

module.exports = new MessageLog();
