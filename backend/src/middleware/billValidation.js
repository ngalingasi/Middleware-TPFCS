// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bill validation rules shared by the dashboard routes and /api/v1
// └──────────────────────────────────────────────────────────────────────────┘

const { body } = require('express-validator');
const GfsCode = require('../models/GfsCode');

// what is wrong with the codes a billing system used, or null when all are its own
function gfsProblem(system, result) {
  if (result.unknown.length > 0) return `Unknown or inactive GFS code(s): ${result.unknown.join(', ')}`;
  if (result.notLinked.length > 0) {
    return `GFS code(s) not linked to billing system ${system.code}: ${result.notLinked.join(', ')}. Ask an admin to link them.`;
  }
  return null;
}

const billValidation = [
  body('billId').notEmpty().withMessage('Bill ID is required'),
  // SIT BP001_10: zero and negative bill amounts must be rejected as
  // invalid request data (GePG code 7242) - isNumeric alone let both through.
  body('billAmount').isFloat({ gt: 0 }).withMessage('Bill amount must be a number greater than zero'),
  body('items.*.billItemAmount').isFloat({ gt: 0 }).withMessage('Each bill item amount must be a number greater than zero'),
  body('billExpiryDate').isISO8601().withMessage('Invalid expiry date format'),
  body('payerId').notEmpty().withMessage('Payer ID is required'),
  body('payerName').notEmpty().withMessage('Payer name is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one bill item is required'),
  body('items').custom(async (items, { req }) => {
    if (!Array.isArray(items)) return true; // the isArray rule above already covers this case
    const submitted = [...new Set(items.map(i => i && i.gfsCode).filter(Boolean))];
    if (submitted.length === 0) return true;

    const system = req.billingSystem;

    // dashboard users may use any active code
    if (!system) {
      const valid = await GfsCode.findActiveCodesIn(submitted);
      const invalid = submitted.filter(c => !valid.includes(c));
      if (invalid.length > 0) throw new Error(`Unknown or inactive GFS code(s): ${invalid.join(', ')}`);
      return true;
    }

    // a billing system may only use the codes linked to it, so one system cannot bill another's revenue
    const problem = gfsProblem(system, await GfsCode.classifyFor(system.id, submitted));
    if (problem) throw new Error(problem);
    return true;
  })
];

const reuseValidation = [
  body('paymentControlNumber').notEmpty().withMessage('paymentControlNumber is required for reuse'),
  body('reuseReason').trim().notEmpty().withMessage('reuseReason is required for reuse')
];

module.exports = { billValidation, reuseValidation, gfsProblem };
