// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ System-facing /api/v1 controller
// └──────────────────────────────────────────────────────────────────────────┘

const eventService = require('../services/eventService');
const Bill = require('../models/Bill');
const caller = require('../utils/caller');

const MAX_BATCH = 100;
const MAX_FEED = 500;

// who am I: lets a billing system confirm its key and system code work
async function ping(req, res) {
  res.json({ success: true, data: { system: req.billingSystem.code, name: req.billingSystem.name, serverTime: new Date().toISOString() } });
}

// events after a cursor: how a system catches up after being down, or works without a callback URL
async function getEvents(req, res) {
  try {
    const after = Math.max(parseInt(req.query.after) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), MAX_FEED);
    res.json({ success: true, data: await eventService.feed(req.billingSystem.id, after, limit) });
  } catch (error) {
    console.error('Event feed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// status of up to 100 bills in one call, by the caller's own references
async function getBillStatuses(req, res) {
  try {
    const refs = (req.body && req.body.billIds) || [];
    if (!Array.isArray(refs) || refs.length === 0 || refs.length > MAX_BATCH || refs.some((r) => typeof r !== 'string' || !r)) {
      return res.status(400).json({ success: false, code: '7242', message: `billIds must be a list of 1 to ${MAX_BATCH} bill references` });
    }

    const rows = await Bill.statusSummaries(caller.systemOf(req).id, refs);
    const found = new Set();
    const bills = rows.map((b) => {
      found.add(b.external_ref);
      found.add(b.bill_id);
      const totalPaid = Number(b.total_paid);
      const billAmount = Number(b.bill_amount);
      return {
        billId: b.external_ref || b.bill_id,
        gepgBillId: b.bill_id,
        status: b.status,
        controlNumber: b.payment_control_number || null,
        billAmount,
        currency: b.currency,
        totalPaid,
        remaining: Math.max(billAmount - totalPaid, 0),
        isPaid: totalPaid >= billAmount,
        expiresAt: b.bill_expiry_date
      };
    });

    res.json({ success: true, data: { bills, notFound: refs.filter((r) => !found.has(r)) } });
  } catch (error) {
    console.error('Bill statuses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { ping, getEvents, getBillStatuses };
