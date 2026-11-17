// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Print controller
// └──────────────────────────────────────────────────────────────────────────┘

const printService = require('../services/printService');

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

/**
 * GET /api/bills/:billId/print?type=bill|transfer
 * Data for the printable bill (Appendix 3) or TISS/SWIFT transfer bill (Appendix 2).
 */
async function getBillPrintData(req, res) {
  try {
    const data = await printService.buildBillDocument(req.params.billId, {
      type: req.query.type || 'bill',
      printedBy: actorName(req)
    });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'Bill print data');
  }
}

/**
 * GET /api/payments/:paymentId/receipt
 * Data for the printable GePG receipt (Appendix 1).
 */
async function getReceiptData(req, res) {
  try {
    const data = await printService.buildReceiptDocument(req.params.paymentId, { issuedBy: actorName(req) });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'Receipt data');
  }
}

module.exports = { getBillPrintData, getReceiptData };
