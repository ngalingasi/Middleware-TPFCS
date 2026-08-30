const db = require('../config/database');

class ApiLog {
  async create({ endpoint, method, requestBody, responseBody, statusCode, ipAddress, userAgent }) {
    await db.query(
      `INSERT INTO api_logs (endpoint, method, request_body, response_body, status_code, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [endpoint, method, requestBody, responseBody, statusCode, ipAddress, userAgent]
    );
  }

  async findAll(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    const whereClause = [];
    const params = [];

    if (filters.endpoint) {
      whereClause.push('endpoint LIKE ?');
      params.push(`%${filters.endpoint}%`);
    }
    if (filters.method) {
      whereClause.push('method = ?');
      params.push(filters.method);
    }
    if (filters.statusCode) {
      whereClause.push('status_code = ?');
      params.push(filters.statusCode);
    }
    if (filters.startDate && filters.endDate) {
      whereClause.push('DATE(created_at) BETWEEN ? AND ?');
      params.push(filters.startDate, filters.endDate);
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM api_logs ${where}`, params);
    const [logs] = await db.query(
      `SELECT * FROM api_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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

  async getStatistics() {
    const [apiStats] = await db.query(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code < 400 THEN 1 END) as successful,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today
      FROM api_logs
    `);
    return apiStats[0];
  }

  async cleanup(days) {
    const [result] = await db.query(
      'DELETE FROM api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    return result.affectedRows;
  }
}

module.exports = new ApiLog();
