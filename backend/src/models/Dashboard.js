const db = require('../config/database');

class Dashboard {
  async getBillStats() {
    const [rows] = await db.query(`
      SELECT
        COUNT(*) as total_bills,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_bills,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_bills,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_bills,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_bills,
        SUM(bill_amount) as total_billed_amount,
        SUM(CASE WHEN status = 'PAID' THEN bill_amount ELSE 0 END) as total_paid_amount
      FROM bills
    `);
    return rows[0];
  }

  async getPaymentStats() {
    const [rows] = await db.query(`
      SELECT
        COUNT(*) as total_payments,
        COUNT(CASE WHEN payment_type = 'ONLINE' THEN 1 END) as online_payments,
        COUNT(CASE WHEN payment_type = 'OFFLINE' THEN 1 END) as offline_payments,
        SUM(paid_amount) as total_collected,
        COUNT(CASE WHEN DATE(transaction_datetime) = CURDATE() THEN 1 END) as today_payments,
        SUM(CASE WHEN DATE(transaction_datetime) = CURDATE() THEN paid_amount ELSE 0 END) as today_amount
      FROM payments
    `);
    return rows[0];
  }

  async getRecentPayments(limit = 10) {
    const [rows] = await db.query(
      `SELECT
        p.id, p.pay_ref_id, p.bill_id, p.paid_amount, p.payer_name,
        p.transaction_datetime, b.bill_description
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      ORDER BY p.transaction_datetime DESC
      LIMIT ?`,
      [limit]
    );
    return rows;
  }

  async getMonthlyTrend() {
    const [rows] = await db.query(`
      SELECT
        DATE_FORMAT(transaction_datetime, '%Y-%m') as month,
        COUNT(*) as payment_count,
        SUM(paid_amount) as total_amount
      FROM payments
      WHERE transaction_datetime >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(transaction_datetime, '%Y-%m')
      ORDER BY month
    `);
    return rows;
  }

  async getRecentActivities(limit = 20) {
    const [rows] = await db.query(
      `SELECT
        'BILL' as activity_type, bill_id as reference_id, payer_name as entity_name,
        bill_amount as amount, status, created_at as activity_date
      FROM bills
      UNION ALL
      SELECT
        'PAYMENT' as activity_type, pay_ref_id as reference_id, payer_name as entity_name,
        paid_amount as amount, status, transaction_datetime as activity_date
      FROM payments
      ORDER BY activity_date DESC
      LIMIT ?`,
      [limit]
    );
    return rows;
  }

  async getPaymentChannelBreakdown() {
    const [rows] = await db.query(`
      SELECT used_payment_channel, COUNT(*) as transaction_count, SUM(paid_amount) as total_amount
      FROM payments
      GROUP BY used_payment_channel
      ORDER BY total_amount DESC
    `);
    return rows;
  }

  async getDailySummary() {
    const [rows] = await db.query(`
      SELECT
        DATE(transaction_datetime) as date,
        COUNT(*) as payment_count,
        SUM(paid_amount) as total_amount,
        COUNT(CASE WHEN payment_type = 'ONLINE' THEN 1 END) as online_count,
        COUNT(CASE WHEN payment_type = 'OFFLINE' THEN 1 END) as offline_count
      FROM payments
      WHERE transaction_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(transaction_datetime)
      ORDER BY date
    `);
    return rows;
  }

  async getTopPayers(limit = 10) {
    const [rows] = await db.query(
      `SELECT payer_name, payer_cell_num, COUNT(*) as payment_count, SUM(paid_amount) as total_paid
      FROM payments
      WHERE payer_name IS NOT NULL AND payer_name != ''
      GROUP BY payer_name, payer_cell_num
      ORDER BY total_paid DESC
      LIMIT ?`,
      [limit]
    );
    return rows;
  }
}

module.exports = new Dashboard();
