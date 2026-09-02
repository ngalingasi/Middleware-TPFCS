const db = require('../config/database');

class Payment {
  /**
   * Persist a payment from GePG's pmtSpNtfReq (spec section 6.2). v5 has a
   * single payment posting flow - paymentData.paymentType is a local
   * ONLINE/OFFLINE approximation derived from the payment channel, not a
   * GePG concept, kept only so existing dashboard stats keep working.
   */
  async create(paymentData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO payments (
          transaction_id, sp_code, pay_ref_id, bill_id, payment_control_number,
          bill_amount, paid_amount, bill_pay_option, currency, transaction_datetime,
          used_payment_channel, payer_cell_num, payer_name, payer_email,
          psp_receipt_number, psp_name, psp_code, credited_account_number,
          payment_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          paymentData.transactionId,
          paymentData.spCode,
          paymentData.payRefId,
          paymentData.billId,
          paymentData.paymentControlNumber,
          paymentData.billAmount,
          paymentData.paidAmount,
          paymentData.billPayOption,
          paymentData.currency,
          paymentData.transactionDateTime,
          paymentData.usedPaymentChannel,
          paymentData.payerCellNumber,
          paymentData.payerName,
          paymentData.payerEmail,
          paymentData.pspReceiptNumber,
          paymentData.pspName,
          paymentData.pspCode,
          paymentData.creditedAccountNumber,
          paymentData.paymentType || 'OFFLINE'
        ]
      );

      await connection.query('UPDATE bills SET status = ? WHERE bill_id = ?', ['PAID', paymentData.billId]);

      await connection.commit();
      return { success: true, paymentId: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async acknowledge(paymentId) {
    await db.query('UPDATE payments SET status = ? WHERE id = ?', ['ACKNOWLEDGED', paymentId]);
    return { success: true };
  }

  async findAll(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    const whereClause = [];
    const params = [];

    if (filters.status) {
      whereClause.push('p.status = ?');
      params.push(filters.status);
    }
    if (filters.paymentType) {
      whereClause.push('p.payment_type = ?');
      params.push(filters.paymentType);
    }
    if (filters.billId) {
      whereClause.push('p.bill_id = ?');
      params.push(filters.billId);
    }
    if (filters.startDate && filters.endDate) {
      whereClause.push('DATE(p.transaction_datetime) BETWEEN ? AND ?');
      params.push(filters.startDate, filters.endDate);
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM payments p ${where}`, params);
    const [payments] = await db.query(
      `SELECT
        p.*,
        b.payer_name as bill_payer_name,
        b.bill_description
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      ${where}
      ORDER BY p.transaction_datetime DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    };
  }

  async findById(paymentId) {
    const [payments] = await db.query(
      `SELECT
        p.*,
        b.payer_name as bill_payer_name,
        b.bill_description,
        b.bill_amount
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      WHERE p.id = ?`,
      [paymentId]
    );
    return payments.length > 0 ? payments[0] : null;
  }

  async getStatistics(startDate, endDate) {
    const [stats] = await db.query(
      `SELECT
        COUNT(*) as total_payments,
        SUM(paid_amount) as total_amount,
        COUNT(CASE WHEN payment_type = 'ONLINE' THEN 1 END) as online_payments,
        COUNT(CASE WHEN payment_type = 'OFFLINE' THEN 1 END) as offline_payments,
        COUNT(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 END) as acknowledged_payments
      FROM payments
      WHERE DATE(transaction_datetime) BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    return stats[0];
  }
}

module.exports = new Payment();
