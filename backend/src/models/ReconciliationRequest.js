const db = require('../config/database');

class ReconciliationRequest {
  /**
   * reconciliationOption is no longer sent to GePG under v5 (the
   * success/exception-report choice was dropped - see reconciliationController),
   * kept here as an optional column only for any pre-v5 historical rows.
   */
  async create({ reconciliationRequestId, spCode, spSysId, transactionDate, reconciliationOption = null }) {
    await db.query(
      `INSERT INTO reconciliation_requests (
        reconciliation_request_id, sp_code, sp_sys_id, transaction_date,
        reconciliation_option, status
      ) VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [reconciliationRequestId, spCode, spSysId, transactionDate, reconciliationOption]
    );
    return { reconciliationRequestId };
  }

  async findByRequestId(reconciliationRequestId) {
    const [rows] = await db.query(
      'SELECT * FROM reconciliation_requests WHERE reconciliation_request_id = ?',
      [reconciliationRequestId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async findAll(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    const whereClause = [];
    const params = [];

    if (filters.status) {
      whereClause.push('status = ?');
      params.push(filters.status);
    }
    if (filters.startDate && filters.endDate) {
      whereClause.push('transaction_date BETWEEN ? AND ?');
      params.push(filters.startDate, filters.endDate);
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM reconciliation_requests ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM reconciliation_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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

  /** Called after GePG's immediate sucSpPmtReqAck */
  async markAcknowledged(reconciliationRequestId, statusCode) {
    await db.query(
      `UPDATE reconciliation_requests SET status = 'PROCESSING', status_code = ? WHERE reconciliation_request_id = ?`,
      [statusCode, reconciliationRequestId]
    );
  }

  async markFailed(reconciliationRequestId, statusCode) {
    await db.query(
      `UPDATE reconciliation_requests SET status = 'FAILED', status_code = ? WHERE reconciliation_request_id = ?`,
      [statusCode, reconciliationRequestId]
    );
  }

  /** Called from the async sucSpPmtRes webhook with the final batch result */
  async markCompleted(reconciliationRequestId, statusCode) {
    await db.query(
      `UPDATE reconciliation_requests SET status = 'COMPLETED', status_code = ? WHERE reconciliation_request_id = ?`,
      [statusCode, reconciliationRequestId]
    );
  }
}

module.exports = new ReconciliationRequest();
