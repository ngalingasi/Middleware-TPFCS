// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Settings registry: every service provider value, with its meaning
// └──────────────────────────────────────────────────────────────────────────┘

// The Settings page is drawn from this list, so the explanations shown to the
// user live next to the validation rules. Values are stored in system_config
// under `key` (the lowercase .env name); a blank value falls back to `env`,
// then `default`.

const GROUPS = [
  {
    id: 'environment',
    title: 'Environment',
    description: 'Which GePG system this installation talks to.'
  },
  {
    id: 'institution',
    title: 'Institution',
    description: 'How your institution is named on printed bills and receipts.'
  },
  {
    id: 'identifiers',
    title: 'GePG identifiers',
    description: 'Codes GePG issued to your institution. They go into every request, so they must match GePG\'s records exactly.',
    critical: true
  },
  {
    id: 'collection',
    title: 'Collection account and QR',
    description: 'Where payers send money and what the QR code points to.'
  },
  {
    id: 'connection',
    title: 'Connection to GePG',
    description: 'Where requests are sent. UAT (test) and production use different values.',
    critical: true
  }
];

const text = (max) => ({ input: 'text', max });

const FIELDS = [
  {
    key: 'gepg_environment', group: 'environment', env: ['GEPG_ENVIRONMENT'],
    label: 'Environment', abbr: 'UAT or Production',
    meaning: 'UAT is GePG\'s test system, production is the live one. A banner is shown on every page while this is UAT, so test bills are not mistaken for real ones.',
    example: 'UAT', providedBy: 'You',
    input: 'select', options: [{ value: 'UAT', label: 'UAT (testing)' }, { value: 'PRODUCTION', label: 'Production (live)' }]
  },

  {
    key: 'gepg_sp_name', group: 'institution', env: ['GEPG_SP_NAME'],
    label: 'SP Name', abbr: 'Service Provider name',
    meaning: 'The full name of your institution (the Service Provider is the institution that issues bills and gets paid). Printed at the top of every bill and receipt.',
    example: 'Tanzania Police Force Corporation Sole', providedBy: 'You', ...text(200)
  },
  {
    key: 'gepg_sp_subtitle', group: 'institution', env: ['GEPG_SP_SUBTITLE'],
    label: 'Title', abbr: 'Heading line',
    meaning: 'Optional second line under the institution name, usually the parent ministry or department.',
    example: 'Ministry of Home Affairs', providedBy: 'You', ...text(200)
  },
  {
    key: 'gepg_collection_centre_name', group: 'institution', env: ['GEPG_COLLECTION_CENTRE_NAME'],
    label: 'Collection Centre', abbr: 'Collection centre name',
    meaning: 'The office where payments are collected. Printed as "Collection Centre" on bills.',
    example: 'HEAD QUARTER', providedBy: 'You', ...text(100)
  },
  {
    key: 'gepg_coll_cent_code', group: 'institution', env: ['GEPG_COLL_CENT_CODE'],
    label: 'Collection Centre Code', abbr: 'CollCentCode',
    meaning: 'GePG\'s code for your collection centre. Optional; used for new bills that do not specify one.',
    example: '14476430002', providedBy: 'GePG', input: 'text', max: 20, pattern: /^[A-Za-z0-9]+$/, hint: 'letters and digits only'
  },

  {
    key: 'gepg_sp_code', group: 'identifiers', env: ['GEPG_SP_CODE'], critical: true,
    label: 'SP Code', abbr: 'Service Provider Code',
    meaning: 'The code GePG gave your institution. Sent with every request, used to number requests, and printed on bills.',
    example: 'SP99128', providedBy: 'GePG', input: 'text', max: 10, pattern: /^[A-Za-z0-9]+$/, hint: 'letters and digits only, up to 10',
    affects: 'every request to GePG'
  },
  {
    key: 'gepg_sub_sp_code', group: 'identifiers', env: ['GEPG_SUB_SP_CODE'], critical: true,
    label: 'Sub SP Code', abbr: 'Sub Service Provider Code',
    meaning: 'Code of a department or unit under your institution. Sent on every bill item.',
    example: '2001', providedBy: 'GePG', input: 'text', max: 10, pattern: /^\d+$/, hint: 'digits only, up to 10',
    affects: 'every bill submitted'
  },
  {
    key: 'gepg_sp_grp_code', group: 'identifiers', env: ['GEPG_SP_GRP_CODE'], critical: true,
    label: 'SP Group Code', abbr: 'SpGrpCode',
    meaning: 'Code for a group of service providers. For normal bills it is the same as the SP Code, so leave it blank unless GePG tells you otherwise.',
    example: 'SPG1000', providedBy: 'GePG', input: 'text', max: 10, pattern: /^[A-Za-z0-9]+$/, hint: 'letters and digits only, up to 10',
    affects: 'every request to GePG'
  },
  {
    key: 'gepg_sys_code', group: 'identifiers', env: ['GEPG_SYS_CODE', 'GEPG_SP_SYS_ID'], critical: true,
    label: 'System Code', abbr: 'SysCode',
    meaning: 'Identifies this billing system to GePG. GePG sends payment notifications and bill responses to the system named here.',
    example: 'SYS001', providedBy: 'GePG', input: 'text', max: 10, pattern: /^[A-Za-z0-9]+$/, hint: 'letters and digits only, up to 10',
    affects: 'every request, and where GePG sends its callbacks'
  },
  {
    key: 'gepg_com', group: 'identifiers', env: ['GEPG_COM'], critical: true,
    label: 'Gepg-Com', abbr: 'Communication identifier',
    meaning: 'Value of the Gepg-Com header on every request. GePG gives it to you during integration.',
    example: 'default.sp.in', providedBy: 'GePG', ...text(100),
    affects: 'every request to GePG'
  },
  {
    key: 'gepg_alg', group: 'identifiers', env: ['GEPG_ALG'], critical: true,
    label: 'Gepg-Alg', abbr: 'Signature algorithm identifier',
    meaning: 'Value of the Gepg-Alg header, naming the signature algorithm. GePG gives it to you during integration.',
    example: 'RSA', providedBy: 'GePG', ...text(50),
    affects: 'every request to GePG'
  },

  {
    key: 'gepg_transfer_beneficiary_name', group: 'collection', env: ['GEPG_TRANSFER_BENEFICIARY_NAME', 'GEPG_SP_NAME'],
    label: 'Beneficiary', abbr: 'Account holder name',
    meaning: 'Name on your collection account. Printed on the bank transfer (TISS/SWIFT) bill. Defaults to the SP Name.',
    example: 'Tanzania Police Force Corporation Sole', providedBy: 'Your bank', ...text(200)
  },
  {
    key: 'gepg_transfer_bank_name', group: 'collection', env: ['GEPG_TRANSFER_BANK_NAME'],
    label: 'Collection Bank', abbr: 'Bank holding the collection account',
    meaning: 'The bank where GePG pays collected money. Printed on the transfer bill.',
    example: 'National Microfinance Bank', providedBy: 'Your bank', ...text(100)
  },
  {
    key: 'gepg_transfer_account_number', group: 'collection', env: ['GEPG_TRANSFER_ACCOUNT_NUMBER'],
    label: 'Account Number', abbr: 'Collection account number',
    meaning: 'Your collection account number. On a transfer, the payer\'s bank must put it in MT103 field 59.',
    example: '20110028382', providedBy: 'Your bank', input: 'text', max: 34, pattern: /^[A-Za-z0-9-]+$/, hint: 'letters, digits and hyphens only'
  },
  {
    key: 'gepg_transfer_swift_code', group: 'collection', env: ['GEPG_TRANSFER_SWIFT_CODE'],
    label: 'SWIFT Code', abbr: 'Bank identifier code (BIC)',
    meaning: 'International identifier of the collection bank, for transfers from other banks.',
    example: 'NMIBTZTZ', providedBy: 'Your bank', input: 'text', max: 11, pattern: /^([A-Za-z0-9]{8}|[A-Za-z0-9]{11})$/, hint: '8 or 11 letters and digits', upper: true
  },
  {
    key: 'gepg_qr_short_code', group: 'collection', env: ['GEPG_QR_SHORT_CODE'], critical: true,
    label: 'QR Paybill Number', abbr: 'QR shortCode',
    meaning: 'GePG\'s paybill number, put in the QR code on printed bills. A wrong number sends payments to the wrong place, so get it from GePG.',
    example: '001001', providedBy: 'GePG', input: 'text', max: 12, pattern: /^\d{3,12}$/, hint: '3 to 12 digits',
    affects: 'payments made by scanning the QR code'
  },
  {
    key: 'print_mobile_money', group: 'collection', env: ['PRINT_MOBILE_MONEY'], default: 'true',
    label: 'Mobile money steps', abbr: 'USSD payment instructions',
    meaning: 'Show mobile-money payment steps on TZS bills. Turn off if your collection account cannot receive mobile-money payments.',
    example: 'Yes', providedBy: 'You',
    input: 'select', options: [{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]
  },

  {
    key: 'gepg_ip', group: 'connection', env: ['GEPG_IP'], critical: true,
    label: 'GePG Host', abbr: 'Server address',
    meaning: 'IP address or host name of GePG\'s server, reached over the VPN.',
    example: '10.1.2.3', providedBy: 'GePG', input: 'text', max: 253, pattern: /^[A-Za-z0-9.-]+$/, hint: 'an IP address or host name',
    affects: 'every request to GePG'
  },
  {
    key: 'gepg_port', group: 'connection', env: ['GEPG_PORT'], critical: true,
    label: 'GePG Port', abbr: 'Server port',
    meaning: 'Port of GePG\'s server.',
    example: '8080', providedBy: 'GePG', input: 'text', max: 5, pattern: /^\d{1,5}$/, hint: 'a number from 1 to 65535',
    validate: (v) => (Number(v) >= 1 && Number(v) <= 65535 ? null : 'Port must be between 1 and 65535'),
    affects: 'every request to GePG'
  },
  ...[
    ['gepg_endpoint_bill_submission', 'GEPG_ENDPOINT_BILL_SUBMISSION', 'Bill Submission Path', 'Where new bills are sent.', '/api/bill/sigqrequest'],
    ['gepg_endpoint_bill_reuse', 'GEPG_ENDPOINT_BILL_REUSE', 'Control Number Reuse Path', 'Where requests to reuse a control number are sent.', '/api/bill/sigqrequest_reuse'],
    ['gepg_endpoint_bill_update', 'GEPG_ENDPOINT_BILL_UPDATE', 'Bill Update Path', 'Where expiry-date changes are sent.', '/api/bill/sigqrequest_change'],
    ['gepg_endpoint_bill_cancellation', 'GEPG_ENDPOINT_BILL_CANCELLATION', 'Bill Cancellation Path', 'Where cancellations are sent.', '/api/bill/sigcancel_request'],
    ['gepg_endpoint_reconciliation', 'GEPG_ENDPOINT_RECONCILIATION', 'Reconciliation Path', 'Where reconciliation requests are sent.', '/api/reconciliations/sig_sp_qrequest']
  ].map(([key, env, label, meaning, def]) => ({
    key, group: 'connection', env: [env], critical: true, default: def,
    label, abbr: 'GePG API path',
    meaning: `${meaning} GePG v5 gives the real paths during integration; the pre-filled one is the older v4 path.`,
    example: def, providedBy: 'GePG', input: 'text', max: 255, pattern: /^\/[^\s]*$/, hint: 'a path starting with /',
    affects: 'the matching request to GePG'
  }))
];

// Values that stay in .env on the server and are never shown or edited on the page.
const ENV_ONLY = [
  { name: 'DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD', meaning: 'Database connection.' },
  { name: 'JWT_SECRET, JWT_EXPIRES_IN', meaning: 'Signs login tokens and sets how long a login lasts.' },
  { name: 'OTP_EXPIRY_MINUTES', meaning: 'How long a one-time login code stays valid.' },
  { name: 'CERT_PATH, CERT_PASSWORD, GEPG_PUBLIC_CERT_PATH', meaning: 'Optional. Certificates are uploaded on this page; these .env values are only used while nothing is uploaded.' },
  { name: 'SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM', meaning: 'Outgoing email, used to send login codes.' },
  { name: 'BRANDBOX_API_KEY, BRANDBOX_API_SECRET, BRANDBOX_SENDER_NAME', meaning: 'BrandBox SMS account, used to send login codes by SMS.' },
  { name: 'PORT, NODE_ENV', meaning: 'Server port and mode.' }
];

const byKey = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

function clean(value) {
  // trim and drop control characters
  return String(value === undefined || value === null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

/**
 * Validates one value. Returns { value } (cleaned, '' meaning "clear it") or { error }.
 */
function validate(field, raw) {
  let value = clean(raw);
  if (value === '') return { value: '' };
  if (field.upper) value = value.toUpperCase();

  if (field.input === 'select') {
    if (!field.options.some((o) => o.value === value)) return { error: `Choose one of: ${field.options.map((o) => o.label).join(', ')}` };
    return { value };
  }
  if (field.max && value.length > field.max) return { error: `At most ${field.max} characters` };
  if (field.pattern && !field.pattern.test(value)) return { error: `Not valid: ${field.hint || 'check the format'}` };
  if (field.validate) {
    const error = field.validate(value);
    if (error) return { error };
  }
  return { value };
}

module.exports = { GROUPS, FIELDS, ENV_ONLY, byKey, validate, clean };
