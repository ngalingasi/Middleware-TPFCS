const db = require('../config/database');

class ReconciliationTransaction {
  /**
   * Bulk-insert the ReconcTrxInf entries carried in a gepgSpReconcResp.
   */
  async createMany(reconciliationRequestId, transactions = []) {
    if (transactions.length === 0) return { inserted: 0 };

    const values = transactions.map(t => [
      reconciliationRequestId,
      t.spBillId,
      t.billControlNumber,
      t.pspTransactionId,
      t.paidAmount,
      t.currency,
      t.payRefId,
      t.transactionDateTime,
      t.creditedAccountNumber,
      t.usedPaymentChannel,
      t.pspName,
      t.pspCode,
      t.depositorCellNum,
      t.depositorName,
      t.depositorEmail,
      t.remarks
    ]);

    const [result] = await db.query(
      `INSERT INTO reconciliation_transactions (
        reconciliation_request_id, sp_bill_id, bill_control_number, psp_transaction_id,
        paid_amount, currency, pay_ref_id, transaction_datetime, credited_account_number,
        used_payment_channel, psp_name, psp_code, depositor_cell_num, depositor_name,
        depositor_email, remarks
      ) VALUES ?`,
      [values]
    );

    return { inserted: result.affectedRows };
  }

  async findByRequestId(reconciliationRequestId) {
    const [rows] = await db.query(
      'SELECT * FROM reconciliation_transactions WHERE reconciliation_request_id = ?',
      [reconciliationRequestId]
    );
    return rows;
  }
}

module.exports = new ReconciliationTransaction();
