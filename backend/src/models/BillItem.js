const db = require('../config/database');

class BillItem {
  async findByBillId(billId) {
    const [rows] = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [billId]);
    return rows;
  }
}

module.exports = new BillItem();
