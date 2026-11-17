// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Print controller
// └──────────────────────────────────────────────────────────────────────────┘

const printService = require('../services/printService');
const Payment = require('../models/Payment');
const caller = require('../utils/caller');

// Printed-by / issued-by: the dashboard user, or the child system's API key name.
function actorName(req) {
  const name = (req.user && req.user.username) || (req.apiKey && req.apiKey.name) || 'SYSTEM';
  return String(name).slice(0, 30);
}

function sendError(res, error, label) {
  // printService throws errors carrying an HTTP status for expected cases
  // (not found, no control number yet, transfer bill not configured).
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(`${label} error:`, error);
  return res.status(500).json({ success: false, message: error.message });
}

async function getBillPrintData(req, res) {
  try {
    const bill = await caller.resolveBill(req, req.params.billId);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const data = await printService.buildBillDocument(bill.bill_id, {
      type: req.query.type || 'bill',
      printedBy: actorName(req)
    });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'Bill print data');
  }
}

async function getReceiptData(req, res) {
  try {
    const system = caller.systemOf(req);
    if (system) {
      const payment = await Payment.findById(req.params.paymentId);
      if (!payment || payment.billing_system_id !== system.id) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }
    }

    const data = await printService.buildReceiptDocument(req.params.paymentId, { issuedBy: actorName(req) });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'Receipt data');
  }
}

module.exports = { getBillPrintData, getReceiptData };
