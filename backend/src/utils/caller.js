// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Caller helper: which billing system is calling, and its bill ids
// └──────────────────────────────────────────────────────────────────────────┘

const Bill = require('../models/Bill');

// GePG's BillId is String(100); the system code and a dash are added in front of the caller's own reference
const MAX_REF_LENGTH = 87;

// null when the caller is a dashboard user rather than a billing system
function systemOf(req) {
  return req.billingSystem || null;
}

/**
 * Prepares a new bill for saving. A billing system's reference becomes
 * "<CODE>-<reference>" at GePG, so two systems can use the same reference.
 * Returns { bill } or { error: { code, message } }.
 */
function prepare(system, body, actor) {
  const ref = String(body.billId === undefined || body.billId === null ? '' : body.billId).trim();

  if (!system) {
    return { bill: { ...body, billId: ref, generatedBy: actor } };
  }
  if (!ref) {
    return { error: { code: '7227', message: 'Bill ID is required' } };
  }
  if (ref.length > MAX_REF_LENGTH) {
    return { error: { code: '7242', message: `billId can be at most ${MAX_REF_LENGTH} characters` } };
  }

  return {
    bill: {
      ...body,
      billId: `${system.code}-${ref}`,
      externalRef: ref,
      billingSystemId: system.id,
      generatedBy: actor
    }
  };
}

// a billing system finds only its own bills (by its reference); dashboard users find any by GePG id
async function resolveBill(req, ref) {
  const system = systemOf(req);
  return system ? Bill.findForSystem(system.id, ref) : Bill.findById(ref);
}

// what a duplicate looks like to the caller
function isDuplicate(error) {
  return error && error.code === 'ER_DUP_ENTRY';
}

module.exports = { MAX_REF_LENGTH, systemOf, prepare, resolveBill, isDuplicate };
