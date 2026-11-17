// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bill validation rules shared by the dashboard routes and /api/v1
// └──────────────────────────────────────────────────────────────────────────┘

const { body } = require('express-validator');
const GfsCode = require('../models/GfsCode');

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
  body('items').custom(async (items) => {
    if (!Array.isArray(items)) return true; // the isArray rule above already covers this case
    const submitted = [...new Set(items.map(i => i && i.gfsCode).filter(Boolean))];
    if (submitted.length === 0) return true;

    const valid = await GfsCode.findActiveCodesIn(submitted);
    const invalid = submitted.filter(c => !valid.includes(c));

    if (invalid.length > 0) {
      throw new Error(`Unknown or inactive GFS code(s): ${invalid.join(', ')}`);
    }
    return true;
  })
];

const reuseValidation = [
  body('paymentControlNumber').notEmpty().withMessage('paymentControlNumber is required for reuse'),
  body('reuseReason').trim().notEmpty().withMessage('reuseReason is required for reuse')
];

module.exports = { billValidation, reuseValidation };
