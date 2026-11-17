// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bill model
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const settings = require('../services/settingsService');
const events = require('../services/eventService');

// all database access for the bills table
class Bill {
  // Create a bill + its items in a single transaction
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
          generated_by, billing_system_id, external_ref, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
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
          billData.collCentCode || settings.get('gepg_coll_cent_code') || null,
          billData.minPayAmt != null ? billData.minPayAmt : null,
          billData.exchRate != null ? billData.exchRate : null,
          billData.payPlan || null,
          billData.payLimTyp || null,
          billData.payLimAmt != null ? billData.payLimAmt : null,
          billData.collPsp || null,
          billData.generatedBy || null,
          billData.billingSystemId || null,
          billData.externalRef || null
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

  // Bills eligible for cancellation per GePG rules (not already paid/cancelled)
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

    if (filters.billingSystemId) {
      whereClause.push('b.billing_system_id = ?');
      params.push(filters.billingSystemId);
    }
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
        s.code AS billing_system_code,
        s.name AS billing_system_name,
        (SELECT COUNT(*) FROM bill_items WHERE bill_id = b.bill_id) as item_count
       FROM bills b
       LEFT JOIN billing_systems s ON s.id = b.billing_system_id
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

  // Called after GePG's immediate acknowledgement (billSubReqAck) to the submit call
  async markSubmitted(billId, ackStatusCode) {
    await db.query(
      'UPDATE bills SET transaction_status_code = ? WHERE bill_id = ?',
      [ackStatusCode, billId]
    );
  }

  async markSubmissionFailed(billId, errorMessage) {
    await db.query(
      'UPDATE bills SET status = ?, transaction_status_code = ? WHERE bill_id = ?',
      // column is VARCHAR(50); a longer message would fail the UPDATE itself
      ['REJECTED', String(errorMessage).slice(0, 50), billId]
    );
  }

  async applySubmissionResponse(billId, { paymentControlNumber, transactionStatus, transactionStatusCode, statusDescription }) {
    // GePG sends BillCntrNum=0 for a failed bill, don't overwrite a stored number with it
    const hasControlNumber = paymentControlNumber && String(paymentControlNumber) !== '0';

    // Per-bill status code decides the outcome, falling back to the header ResSts when absent
    const isDuplicateWithControlNumber = String(transactionStatusCode) === '7226' && hasControlNumber;
    const succeeded = transactionStatusCode
      ? String(transactionStatusCode) === '7101' || isDuplicateWithControlNumber
      : transactionStatus === 'GS';

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [found] = await connection.query('SELECT * FROM bills WHERE bill_id = ? FOR UPDATE', [billId]);
      const before = found[0];
      if (!before) {
        await connection.rollback();
        return null;
      }

      await connection.query(
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

      const [updated] = await connection.query('SELECT * FROM bills WHERE bill_id = ?', [billId]);
      const after = updated[0];

      // tell the owning billing system, but only when the status really changed (GePG may repeat a response)
      if (before.status !== after.status) {
        if (after.status === 'APPROVED') {
          await events.emit(connection, after, 'bill.approved');
        } else if (after.status === 'REJECTED') {
          await events.emit(connection, after, 'bill.rejected', {
            reason: { code: String(transactionStatusCode || ''), description: statusDescription || '' }
          });
        }
      }

      await connection.commit();
      return after;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // status of many of a system's bills at once, by its own references
  async statusSummaries(systemId, refs) {
    const [rows] = await db.query(
      `SELECT b.bill_id, b.external_ref, b.status, b.payment_control_number, b.bill_amount, b.currency,
              b.bill_expiry_date, COALESCE(SUM(p.paid_amount), 0) AS total_paid
       FROM bills b LEFT JOIN payments p ON p.bill_id = b.bill_id
       WHERE b.billing_system_id = ? AND (b.external_ref IN (?) OR b.bill_id IN (?))
       GROUP BY b.id`,
      [systemId, refs, refs]
    );
    return rows;
  }

  // the owner's own reference or the GePG bill id both find it, but only among that system's bills
  async findForSystem(systemId, ref) {
    const [rows] = await db.query(
      'SELECT * FROM bills WHERE billing_system_id = ? AND (external_ref = ? OR bill_id = ?) LIMIT 1',
      [systemId, ref, ref]
    );
    return rows[0] || null;
  }

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

  async markRejectedByAck(billId, ackStatusCode) {
    await db.query(
      `UPDATE bills SET status = 'REJECTED', transaction_status_code = ? WHERE bill_id = ? AND status = 'PENDING'`,
      [String(ackStatusCode).slice(0, 50), billId]
    );
  }

  async markCancelled(billId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [found] = await connection.query('SELECT * FROM bills WHERE bill_id = ? FOR UPDATE', [billId]);
      const before = found[0];
      if (!before) {
        await connection.rollback();
        return;
      }

      await connection.query('UPDATE bills SET status = ? WHERE bill_id = ?', ['CANCELLED', billId]);
      if (before.status !== 'CANCELLED') {
        await events.emit(connection, { ...before, status: 'CANCELLED' }, 'bill.cancelled');
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // approved bills past their expiry date become EXPIRED, once, and the owner is told
  async expireDue() {
    const [due] = await db.query(`SELECT bill_id FROM bills WHERE status = 'APPROVED' AND bill_expiry_date < NOW() LIMIT 200`);
    let expired = 0;

    for (const { bill_id: billId } of due) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [found] = await connection.query(
          `SELECT * FROM bills WHERE bill_id = ? AND status = 'APPROVED' AND bill_expiry_date < NOW() FOR UPDATE`,
          [billId]
        );
        const bill = found[0];
        if (bill) {
          await connection.query(`UPDATE bills SET status = 'EXPIRED' WHERE bill_id = ?`, [billId]);
          const expiredBill = { ...bill, status: 'EXPIRED' };
          await events.emit(connection, expiredBill, 'bill.expired', { totals: await events.totalsFor(connection, expiredBill) });
          expired++;
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error(`Could not expire bill ${billId}:`, error.message);
      } finally {
        connection.release();
      }
    }
    return expired;
  }

  async markPaid(billId) {
    await db.query('UPDATE bills SET status = ? WHERE bill_id = ?', ['PAID', billId]);
  }
}

module.exports = new Bill();
