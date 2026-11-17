// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Payment model
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const events = require('../services/eventService');

class Payment {
  async create(paymentData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // lock the bill so concurrent payments for it are summed one at a time
      const [lockedBill] = await connection.query('SELECT * FROM bills WHERE bill_id = ? FOR UPDATE', [paymentData.billId]);
      const statusBefore = lockedBill[0] && lockedBill[0].status;

      const [existing] = await connection.query(
        'SELECT id FROM payments WHERE transaction_id = ? LIMIT 1',
        [paymentData.transactionId]
      );
      if (existing.length > 0) {
        await connection.rollback();
        return { success: true, duplicate: true, paymentId: existing[0].id };
      }

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

      // PAID only once payments cover the billed amount; a partial payment leaves the status alone.
      // Same transaction, so the sum includes the row inserted above.
      await connection.query(
        `UPDATE bills b SET b.status = 'PAID'
         WHERE b.bill_id = ?
           AND (SELECT COALESCE(SUM(p.paid_amount), 0) FROM payments p WHERE p.bill_id = b.bill_id) >= b.bill_amount`,
        [paymentData.billId]
      );

      // tell the owning billing system: the payment, and the bill too when this payment settled it
      const [afterRows] = await connection.query('SELECT * FROM bills WHERE bill_id = ?', [paymentData.billId]);
      const bill = afterRows[0];
      const [paymentRows] = await connection.query('SELECT * FROM payments WHERE id = ?', [result.insertId]);
      const totals = await events.totalsFor(connection, bill);
      await events.emit(connection, bill, 'payment.received', {
        payment: events.paymentBlock(paymentRows[0]),
        totals,
        source: paymentData.source || 'gepg'
      });
      if (statusBefore !== 'PAID' && bill.status === 'PAID') {
        await events.emit(connection, bill, 'bill.paid', { totals });
      }

      await connection.commit();
      return { success: true, paymentId: result.insertId };
    } catch (error) {
      await connection.rollback();
      // Lost a race with a concurrent delivery of the same transaction.
      if (error.code === 'ER_DUP_ENTRY') {
        return { success: true, duplicate: true };
      }
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
    if (filters.billingSystemId) {
      whereClause.push('b.billing_system_id = ?');
      params.push(filters.billingSystemId);
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

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM payments p LEFT JOIN bills b ON p.bill_id = b.bill_id ${where}`,
      params
    );
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

  // All payments recorded against a bill, oldest first
  async findByBillId(billId) {
    const [payments] = await db.query(
      'SELECT * FROM payments WHERE bill_id = ? ORDER BY transaction_datetime ASC',
      [billId]
    );
    return payments;
  }

  async findById(paymentId) {
    const [payments] = await db.query(
      `SELECT
        p.*,
        b.payer_name as bill_payer_name,
        b.bill_description,
        b.bill_amount,
        b.billing_system_id
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      WHERE p.id = ?`,
      [paymentId]
    );
    return payments.length > 0 ? payments[0] : null;
  }

  async getStatistics(startDate, endDate, billingSystemId) {
    const [stats] = await db.query(
      `SELECT
        COUNT(*) as total_payments,
        SUM(p.paid_amount) as total_amount,
        COUNT(CASE WHEN p.payment_type = 'ONLINE' THEN 1 END) as online_payments,
        COUNT(CASE WHEN p.payment_type = 'OFFLINE' THEN 1 END) as offline_payments,
        COUNT(CASE WHEN p.status = 'ACKNOWLEDGED' THEN 1 END) as acknowledged_payments
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      WHERE DATE(p.transaction_datetime) BETWEEN ? AND ?
        ${billingSystemId ? 'AND b.billing_system_id = ?' : ''}`,
      billingSystemId ? [startDate, endDate, billingSystemId] : [startDate, endDate]
    );
    return stats[0];
  }
}

module.exports = new Payment();
