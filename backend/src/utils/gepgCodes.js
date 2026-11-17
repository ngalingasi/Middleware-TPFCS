/**
 * GePG response/status code catalogue.
 *
 * Sources: GePG API v5.0 section 14.2 (Response Codes), the separate
 * "Gepg error codes" list GePG shared, and codes that only appear in the
 * spec's sample payloads (7102, 7283). The SIT sheet requires every GePG
 * error code to be visible in the user interface, so anything that surfaces
 * a code should resolve it through describeCode() rather than showing a bare
 * number.
 *
 * The code list "may be added to" by GePG with prior notice (spec 14.2), so
 * unknown codes degrade to a generic description instead of throwing.
 */

const GEPG_CODES = {
  // Generic
  '7101': 'Successful',
  '7102': 'Failure',
  '7201': 'Failure',
  '7202': 'Required header is not given',
  '7203': 'Unauthorized',

  // Bill / service provider validation
  '7204': 'Bill does not exist',
  '7205': 'Invalid service provider',
  '7206': 'Service provider is not active',
  '7207': 'Duplicate payment',
  '7208': 'Invalid business account',
  '7209': 'Business account is not active',
  '7210': 'Collection account balance limit reached',
  '7211': 'Payment service provider code did not match Bill service provider code',
  '7212': 'Payment currency did not match Bill currency',
  '7213': 'Bill has expired',
  '7214': 'Insufficient amount paid',
  '7215': 'Invalid payment service provider',
  '7216': 'Payment service provider is not active',
  '7217': 'No payer email or phone number',
  '7218': 'Wrong payer identity',
  '7219': 'Wrong currency',
  '7220': 'Sub service provider is inactive',
  '7221': 'Wrong bill equivalent amount',
  '7222': 'Wrong bill miscellaneous amount',
  '7223': 'Invalid or inactive GFS code or service type',
  '7224': 'Wrong bill amount',
  '7225': 'Invalid bill reference number or code',
  '7226': 'Duplicate bill information',
  '7227': 'Blank bill identification number',
  '7228': 'Invalid sub service provider',
  '7229': 'Wrong bill item GFS or payment type code',
  '7230': 'Wrong bill generation date',
  '7231': 'Wrong bill expiry date',
  '7232': 'Consumer already started by another process',
  '7233': 'Consumer already stopped by another process',
  // Present in GePG's list with its code label missing; 7234 is the only
  // gap between 7233 and 7235 and the description is the payment option rule.
  '7234': 'Wrong bill payment option',
  '7235': 'Bill creation completed successfully',
  '7236': 'Bill creation completed with errors',
  '7237': 'Bill detail creation completed successfully',
  '7238': 'Bill detail creation completed with errors',
  '7239': 'No external bill system settings found',
  '7240': 'Failed to save transaction',
  '7241': 'Invalid session',
  '7242': 'Invalid request data',
  '7243': 'Invalid credit account',
  '7244': 'Invalid transfer amount',
  '7245': 'Invalid credit account name',
  '7246': 'Invalid debit account',
  '7247': 'Invalid transfer transaction description',

  // Payment / batch / reconciliation
  '7279': 'Bill already settled',
  '7281': 'Invalid payment transaction date',
  '7283': 'Bill has been cancelled',
  '7284': 'Payment currency did not match collection account currency',
  '7289': 'Invalid batch generated date',
  '7290': 'Total batch amount cannot be zero (0)',
  '7291': 'Total batch amount is not equal to summation of items (transactions)',
  '7297': 'Inactive currency',
  '7301': 'Bill has been paid partially',
  '7302': 'Paid amount is not exact billed amount',
  '7303': 'Invalid signature',
  '7304': 'Invalid signature configuration, missing one of the parameters',
  '7305': 'Invalid batch start and end date',
  '7306': 'Batch has no item (transaction)',
  '7307': 'Inconsistency in batch start, end and generated date',
  '7311': 'Invalid GePG configurations, missing one of the parameters',
  '7317': 'Error on processing request',
  '7318': 'Invalid reconciliation request date',
  '7319': 'Reconciliation request date is out of allowable range',
  '7321': 'Request cannot complete at this time, try later',
  '7322': 'Inactive communication protocol',
  '7323': 'Invalid code, mismatch of supplied code on information and header',
  '7333': 'Invalid bill control number',
  '7335': 'Requested bill control number does not exist',
  '7336': 'Requested bill amount has reached the maximum payable limit',
  '7337': 'Requested resource is not available'
};

const UNKNOWN_DESCRIPTION = 'Unrecognised GePG response code';

/**
 * Describe one code. Unknown codes return a generic description rather than
 * undefined so callers can always render something.
 */
function describeCode(code) {
  const key = String(code === undefined || code === null ? '' : code).trim();
  if (!key) return '';
  return GEPG_CODES[key] || UNKNOWN_DESCRIPTION;
}

/**
 * GePG may return several codes in one field, separated by ';' (spec 4.6,
 * AckStsCode). Returns [{ code, description }] for each.
 */
function describeCodes(codes) {
  return String(codes === undefined || codes === null ? '' : codes)
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(code => ({ code, description: describeCode(code) }));
}

function listCodes() {
  return Object.entries(GEPG_CODES).map(([code, description]) => ({ code, description }));
}

module.exports = { GEPG_CODES, describeCode, describeCodes, listCodes };
