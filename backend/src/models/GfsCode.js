const db = require('../config/database');

/**
 * GFS (Government Financial Statistics) codes master list.
 * Admin-managed reference data used to validate bill items at creation
 * time (see billRoutes.js) instead of accepting any free-text string.
 */
class GfsCode {
  async create({ code, description, createdBy }) {
    const [result] = await db.query(
      `INSERT INTO gfs_codes (code, description, created_by, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [code, description || null, createdBy]
    );
    return result.insertId;
  }

  /**
   * Flat, unpaginated list of ACTIVE codes - GFS lists are small (dozens,
   * not thousands). Used by the bill-create dropdown and by the
   * child-system-facing GET /api/gfs-codes endpoint.
   */
  async findAllActive() {
    const [rows] = await db.query(
      `SELECT id, code, description, status, created_at
       FROM gfs_codes WHERE status = 'ACTIVE' ORDER BY code ASC`
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

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM gfs_codes k ${where}`, params);
    const [rows] = await db.query(
      `SELECT k.id, k.code, k.description, k.status, k.created_at, k.updated_at, u.username as created_by_username
       FROM gfs_codes k
       LEFT JOIN users u ON k.created_by = u.id
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

  async update(id, { description, status }) {
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

    if (fields.length === 0) return;

    params.push(id);
    await db.query(`UPDATE gfs_codes SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async delete(id) {
    await db.query('DELETE FROM gfs_codes WHERE id = ?', [id]);
  }

  /**
   * Given a list of submitted codes, returns the subset that are known
   * and ACTIVE - a single query regardless of how many bill items were
   * submitted. Callers diff this against what was submitted to find the
   * invalid ones.
   */
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
