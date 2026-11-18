// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GFS code model
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');

// GFS (Government Financial Statistics) codes master list
class GfsCode {
  async create({ code, description, createdBy, billingSystemId }) {
    const [result] = await db.query(
      `INSERT INTO gfs_codes (code, description, billing_system_id, created_by, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [code, description || null, billingSystemId || null, createdBy]
    );
    return result.insertId;
  }

  // Flat, unpaginated list of ACTIVE codes - GFS lists are small (dozens, not thousands)
  // all active codes, or only the ones linked to one billing system
  async findAllActive(systemId) {
    const [rows] = await db.query(
      `SELECT id, code, description, status, created_at
       FROM gfs_codes WHERE status = 'ACTIVE' ${systemId ? 'AND billing_system_id = ?' : ''} ORDER BY code ASC`,
      systemId ? [systemId] : []
    );
    return rows;
  }

  async findAllAdmin(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    const whereClause = [];
    const params = [];

    if (filters.status) {
      whereClause.push('k.status = ?');
      params.push(filters.status);
    }
    if (filters.systemId) {
      whereClause.push('k.billing_system_id = ?');
      params.push(filters.systemId);
    }
    if (filters.unlinked) {
      whereClause.push('k.billing_system_id IS NULL');
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM gfs_codes k ${where}`, params);
    const [rows] = await db.query(
      `SELECT k.id, k.code, k.description, k.status, k.created_at, k.updated_at, k.billing_system_id,
              s.code AS billing_system_code, s.name AS billing_system_name, u.username as created_by_username
       FROM gfs_codes k
       LEFT JOIN users u ON k.created_by = u.id
       LEFT JOIN billing_systems s ON s.id = k.billing_system_id
       ${where}
       ORDER BY k.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    };
  }

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM gfs_codes WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async update(id, { description, status, billingSystemId }) {
    const fields = [];
    const params = [];

    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }
    // null unlinks the code, a number moves it to that system
    if (billingSystemId !== undefined) {
      fields.push('billing_system_id = ?');
      params.push(billingSystemId);
    }

    if (fields.length === 0) return;

    params.push(id);
    await db.query(`UPDATE gfs_codes SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async delete(id) {
    await db.query('DELETE FROM gfs_codes WHERE id = ?', [id]);
  }

  // sorts submitted codes for one billing system: its own, ones that do not exist or are switched off, and ones linked elsewhere
  async classifyFor(systemId, codes) {
    const result = { usable: [], unknown: [], notLinked: [] };
    if (!codes || codes.length === 0) return result;

    const [rows] = await db.query('SELECT code, status, billing_system_id FROM gfs_codes WHERE code IN (?)', [codes]);
    const byCode = new Map(rows.map((r) => [r.code, r]));

    codes.forEach((code) => {
      const row = byCode.get(code);
      if (!row || row.status !== 'ACTIVE') result.unknown.push(code);
      else if (row.billing_system_id !== systemId) result.notLinked.push(code);
      else result.usable.push(code);
    });
    return result;
  }

  // every code linked to a system, and every other code that could be linked to it
  async linkedAndAvailable(systemId) {
    const [rows] = await db.query(
      `SELECT k.id, k.code, k.description, k.status, k.billing_system_id, s.code AS billing_system_code
       FROM gfs_codes k LEFT JOIN billing_systems s ON s.id = k.billing_system_id
       ORDER BY k.code ASC`
    );
    return {
      linked: rows.filter((r) => r.billing_system_id === systemId),
      available: rows.filter((r) => r.billing_system_id !== systemId)
    };
  }

  // links the codes to a system (moving any that belonged to another); returns what each belonged to before
  async linkToSystem(systemId, codeIds) {
    if (!codeIds || codeIds.length === 0) return [];
    const [before] = await db.query(
      `SELECT k.id, k.code, k.billing_system_id AS previous_id, s.code AS previous_code
       FROM gfs_codes k LEFT JOIN billing_systems s ON s.id = k.billing_system_id WHERE k.id IN (?)`,
      [codeIds]
    );
    await db.query('UPDATE gfs_codes SET billing_system_id = ? WHERE id IN (?)', [systemId, codeIds]);
    return before;
  }

  async unlink(systemId, codeId) {
    const [result] = await db.query('UPDATE gfs_codes SET billing_system_id = NULL WHERE id = ? AND billing_system_id = ?', [codeId, systemId]);
    return result.affectedRows;
  }

  async findActiveCodesIn(codes) {
    if (!codes || codes.length === 0) return [];
    const [rows] = await db.query(
      `SELECT code FROM gfs_codes WHERE code IN (?) AND status = 'ACTIVE'`,
      [codes]
    );
    return rows.map(r => r.code);
  }
}

module.exports = new GfsCode();
