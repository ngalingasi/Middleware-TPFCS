// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Event payload shapes, and sample events for the documentation
// └──────────────────────────────────────────────────────────────────────────┘

function envelope(row) {
  return {
    id: String(row.id),
    type: row.type,
    createdAt: new Date(row.created_at).toISOString(),
    ...JSON.parse(row.payload)
  };
}

function billBlock(bill) {
  return {
    billId: bill.external_ref || bill.bill_id,
    gepgBillId: bill.bill_id,
    controlNumber: bill.payment_control_number || null,
    status: bill.status
  };
}

function paymentBlock(p) {
  return {
    receiptNumber: p.pay_ref_id,
    transactionId: p.transaction_id,
    paidAmount: Number(p.paid_amount),
    currency: p.currency,
    channel: p.used_payment_channel,
    psp: p.psp_name,
    paidAt: p.transaction_datetime,
    payerName: p.payer_name || null,
    payerPhone: p.payer_cell_num || null
  };
}

// a sample of each event, built with the same functions as real ones so the documentation cannot drift
function sampleEvent(type, { code = 'ICDV', id = 184 } = {}) {
  const bill = {
    bill_id: `${code}-INV-1001`,
    external_ref: 'INV-1001',
    payment_control_number: '991330026625',
    status: 'APPROVED'
  };
  const payment = {
    pay_ref_id: '99015046706', transaction_id: 'T1001', paid_amount: 300000, currency: 'TZS',
    used_payment_channel: 'MB', psp_name: 'Example Bank', transaction_datetime: '2026-11-16T09:35:00',
    payer_name: null, payer_cell_num: null
  };
  const part = { billAmount: 500000, totalPaid: 300000, remaining: 200000, isPaid: false };
  const full = { billAmount: 500000, totalPaid: 500000, remaining: 0, isPaid: true };

  const payloads = {
    'bill.approved': { bill: billBlock(bill) },
    'bill.rejected': {
      bill: billBlock({ ...bill, payment_control_number: null, status: 'REJECTED' }),
      reason: { code: '7223', description: 'Invalid or inactive GFS code or service type' }
    },
    'payment.received': { bill: billBlock(bill), payment: paymentBlock(payment), totals: part, source: 'gepg' },
    'bill.paid': { bill: billBlock({ ...bill, status: 'PAID' }), totals: full },
    'bill.cancelled': { bill: billBlock({ ...bill, status: 'CANCELLED' }) },
    'bill.expired': { bill: billBlock({ ...bill, status: 'EXPIRED' }), totals: part },
    'system.test': { message: 'Test event from the GePG bridge' }
  };

  return envelope({ id, type, created_at: '2026-11-16T09:35:12.000Z', payload: JSON.stringify(payloads[type]) });
}

module.exports = { envelope, billBlock, paymentBlock, sampleEvent };
