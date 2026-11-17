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
          reminder_flag, bill_pay_option,
          cust_tin, cust_id_typ, cust_accnt, coll_cent_code, min_pay_amt,
          exch_rate, pay_plan, pay_lim_typ, pay_lim_amt, coll_psp,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
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
          billData.billPayOption || 1,
          billData.custTin || null,
          billData.custIdTyp || null,
          billData.custAccnt || null,
          billData.collCentCode || null,
          billData.minPayAmt != null ? billData.minPayAmt : null,
          billData.exchRate != null ? billData.exchRate : null,
          billData.payPlan || null,
          billData.payLimTyp || null,
          billData.payLimAmt != null ? billData.payLimAmt : null,
          billData.collPsp || null
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
          item.gfsCode,
          item.refBillId || billData.billId,
          item.collSp || null
        ]);

        await connection.query(
          `INSERT INTO bill_items (
            bill_id, bill_item_ref, use_item_ref_on_pay, bill_item_amount,
            bill_item_equiv_amount, bill_item_misc_amount, gfs_code,
            ref_bill_id, coll_sp
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
   * Called after GePG's immediate acknowledgement (billSubReqAck) to the
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
      // transaction_status_code is VARCHAR(50) - a long error message would
      // otherwise fail the UPDATE itself (strict mode) and mask the real error.
      ['REJECTED', String(errorMessage).slice(0, 50), billId]
    );
  }

  /**
   * Called from the async billSubRes webhook - this carries the real
   * outcome (GS/GF) and the payment control number.
   */
  async applySubmissionResponse(billId, { paymentControlNumber, transactionStatus, transactionStatusCode }) {
    // GePG sends BillCntrNum=0 on a failed bill - never overwrite a stored
    // control number with that placeholder.
    const hasControlNumber = paymentControlNumber && String(paymentControlNumber) !== '0';

    // Per-bill status code decides the outcome, falling back to the header
    // ResSts when absent. 7226 (duplicate bill information) is NOT a
    // failure: spec 4.1 says a resubmitted BillId is answered with the
    // previously issued control number, so keep it and treat the bill as
    // approved (SIT BP001_05).
    const isDuplicateWithControlNumber = String(transactionStatusCode) === '7226' && hasControlNumber;
    // A failed response for a bill that already holds a control number (e.g.
    // a rejected expiry change) must not downgrade it - see the status CASE.
    const succeeded = transactionStatusCode
      ? String(transactionStatusCode) === '7101' || isDuplicateWithControlNumber
      : transactionStatus === 'GS';

    await db.query(
      `UPDATE bills SET
        payment_control_number = CASE WHEN ? THEN ? ELSE payment_control_number END,
        status = CASE
          WHEN status IN ('PAID', 'CANCELLED') THEN status
          WHEN ? = 'APPROVED' THEN 'APPROVED'
          WHEN status = 'APPROVED' AND payment_control_number IS NOT NULL THEN status
          ELSE 'REJECTED'
        END,
        transaction_status = ?,
        transaction_status_code = ?
      WHERE bill_id = ?`,
      [
        hasControlNumber ? 1 : 0,
        hasControlNumber ? String(paymentControlNumber) : null,
        succeeded ? 'APPROVED' : 'REJECTED',
        succeeded ? 'GS' : 'GF',
        transactionStatusCode,
        billId
      ]
    );
  }

  /**
   * Most recent bill that was issued the given control number. Used to
   * validate a reuse request: GePG only lets a control number be reused by
   * the institution that was issued it.
   */
  async findByControlNumber(controlNumber) {
    const [rows] = await db.query(
      'SELECT * FROM bills WHERE payment_control_number = ? ORDER BY id DESC LIMIT 1',
      [String(controlNumber)]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async updateExpiry(billId, billExpiryDate) {
    await db.query('UPDATE bills SET bill_expiry_date = ? WHERE bill_id = ?', [billExpiryDate, billId]);
  }

  /**
   * Record that GePG's immediate acknowledgement refused the request, so the
   * bill shows as REJECTED with the code instead of staying PENDING forever.
   */
  async markRejectedByAck(billId, ackStatusCode) {
    await db.query(
      `UPDATE bills SET status = 'REJECTED', transaction_status_code = ? WHERE bill_id = ? AND status = 'PENDING'`,
      [String(ackStatusCode).slice(0, 50), billId]
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
