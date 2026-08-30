const db = require('../config/database');

class ActivityLog {
  async create(logData) {
    await db.query(
      `INSERT INTO activity_logs
       (user_id, action, entity_type, entity_id, description, ip_address,
        user_agent, request_data, response_data, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logData.user_id,
        logData.action,
        logData.entity_type,
        logData.entity_id,
        logData.description,
        logData.ip_address,
        logData.user_agent,
        JSON.stringify(logData.request_data),
        JSON.stringify(logData.response_data),
        logData.status
      ]
    );
  }

  async findAll(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    const whereClause = [];
    const params = [];

    if (filters.userId) {
      whereClause.push('l.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.action) {
      whereClause.push('l.action LIKE ?');
      params.push(`%${filters.action}%`);
    }
    if (filters.entityType) {
      whereClause.push('l.entity_type = ?');
      params.push(filters.entityType);
    }
    if (filters.status) {
      whereClause.push('l.status = ?');
      params.push(filters.status);
    }
    if (filters.startDate && filters.endDate) {
      whereClause.push('DATE(l.created_at) BETWEEN ? AND ?');
      params.push(filters.startDate, filters.endDate);
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM activity_logs l ${where}`, params);
    const [logs] = await db.query(
      `SELECT l.*, u.username, u.full_name
       FROM activity_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    };
  }

  async findById(id) {
    const [logs] = await db.query(
      `SELECT l.*, u.username, u.full_name, u.email
       FROM activity_logs l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.id = ?`,
      [id]
    );
    return logs.length > 0 ? logs[0] : null;
  }

  async getStatistics() {
    const [activityStats] = await db.query(`
      SELECT
        COUNT(*) as total_activities,
        COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today
      FROM activity_logs
    `);

    const [topActions] = await db.query(`
      SELECT action, COUNT(*) as count
      FROM activity_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `);

    const [topUsers] = await db.query(`
      SELECT u.username, u.full_name, COUNT(l.id) as activity_count
      FROM activity_logs l
      JOIN users u ON l.user_id = u.id
      WHERE l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY u.id, u.username, u.full_name
      ORDER BY activity_count DESC
      LIMIT 10
    `);

    return { activityStats: activityStats[0], topActions, topUsers };
  }

  async cleanup(days) {
    const [result] = await db.query(
      'DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    return result.affectedRows;
  }
}

module.exports = new ActivityLog();
