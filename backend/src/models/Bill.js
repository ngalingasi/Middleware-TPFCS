const db = require('../config/database');

/**
 * Bill model
 * Owns all direct database access for the `bills` table.
 * No GePG/XML/HTTP logic here - that belongs in services/controllers.
 */
class Bill {
  /**
   * Create a bill + its items in a single transaction.
   * Item persistence is delegated to BillItem, but kept in the same
   * DB transaction, so this accepts a connection-aware pattern.
   */
  async create(billData, items = []) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO bills (
          bill_id, sub_sp_code, sp_sys_id, bill_amount, misc_amount,
          bill_expiry_date, payer_id, payer_name, payer_cell_num,
          payer_email, bill_description, currency, bill_equiv_amount,
          reminder_flag, bill_pay_option, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          billData.billId,
          billData.subSpCode,
          billData.spSysId,
          billData.billAmount,
          billData.miscAmount || 0,
          billData.billExpiryDate,
          billData.payerId,
          billData.payerName,
          billData.payerCellNumber,
          billData.payerEmail,
          billData.billDescription,
          billData.currency || 'TZS',
          billData.billEquivAmount,
          billData.reminderFlag !== false,
          billData.billPayOption || 1
        ]
      );

      if (items.length > 0) {
        const itemValues = items.map(item => [
          billData.billId,
          item.billItemRef,
          item.useItemRefOnPay || 'N',
          item.billItemAmount,
          item.billItemEquivAmount,
          item.billItemMiscAmount || 0,
          item.gfsCode
        ]);

        await connection.query(
          `INSERT INTO bill_items (
            bill_id, bill_item_ref, use_item_ref_on_pay, bill_item_amount,
            bill_item_equiv_amount, bill_item_misc_amount, gfs_code
          ) VALUES ?`,
          [itemValues]
        );
      }

      await connection.commit();
      return { success: true, billId: billData.billId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findById(billId) {
    const [rows] = await db.query('SELECT * FROM bills WHERE bill_id = ?', [billId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Bills eligible for cancellation per GePG rules (not already paid/cancelled).
   */
  async findCancellable(billId) {
    const [rows] = await db.query(
      `SELECT * FROM bills WHERE bill_id = ? AND status IN ('PENDING', 'APPROVED')`,
      [billId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async findAll(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    const whereClause = [];
    const params = [];

    if (filters.status) {
      whereClause.push('b.status = ?');
      params.push(filters.status);
    }
    if (filters.paymentControlNumber) {
      whereClause.push('b.payment_control_number = ?');
      params.push(filters.paymentControlNumber);
    }
    if (filters.startDate && filters.endDate) {
      whereClause.push('DATE(b.created_at) BETWEEN ? AND ?');
      params.push(filters.startDate, filters.endDate);
    }

    const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM bills b ${where}`, params);
    const [bills] = await db.query(
      `SELECT
        b.*,
        (SELECT COUNT(*) FROM bill_items WHERE bill_id = b.bill_id) as item_count
       FROM bills b
       ${where}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: bills,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / limit)
      }
    };
  }

  /**
   * Called after GePG's immediate acknowledgement (gepgBillSubReqAck) to the
   * submit call. This is NOT the final bill status - just "GePG received it".
   */
  async markSubmitted(billId, ackStatusCode) {
    await db.query(
      'UPDATE bills SET transaction_status_code = ? WHERE bill_id = ?',
      [ackStatusCode, billId]
    );
  }

  async markSubmissionFailed(billId, errorMessage) {
    await db.query(
      'UPDATE bills SET status = ?, transaction_status_code = ? WHERE bill_id = ?',
      ['REJECTED', errorMessage, billId]
    );
  }

  /**
   * Called from the async gepgBillSubResp webhook - this carries the real
   * outcome (GS/GF) and the payment control number.
   */
  async applySubmissionResponse(billId, { paymentControlNumber, transactionStatus, transactionStatusCode }) {
    await db.query(
      `UPDATE bills SET
        payment_control_number = ?,
        status = ?,
        transaction_status = ?,
        transaction_status_code = ?
      WHERE bill_id = ?`,
      [
        paymentControlNumber,
        transactionStatus === 'GS' ? 'APPROVED' : 'REJECTED',
        transactionStatus,
        transactionStatusCode,
        billId
      ]
    );
  }

  async markCancelled(billId) {
    await db.query('UPDATE bills SET status = ? WHERE bill_id = ?', ['CANCELLED', billId]);
  }

  async markPaid(billId) {
    await db.query('UPDATE bills SET status = ? WHERE bill_id = ?', ['PAID', billId]);
  }
}

module.exports = new Bill();
