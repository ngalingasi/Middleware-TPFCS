// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Print service
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Payment = require('../models/Payment');
const { amountInWords } = require('../utils/amountInWords');

/**
 * Printable GePG bill / transfer bill / receipt documents.
 *
 * Content follows GePG's "MWONGOZO wa namna ya kuandaa ankara, kufanya malipo
 * na risiti za GePG" (bill must show control number, payment reference, SP
 * code, payer name and phone, description, service type, amount in figures
 * and words, printed date, expiry, issued-by, printed-by, signature; receipt
 * must show receipt number, payer, paid amount in figures and words, SP name,
 * bill reference, control number, payment date, issued-by, date issued,
 * signature), its Appendix 1-3 samples, and the GePG QR Code Specification
 * v1.2 for the QR payload.
 *
 * This service only assembles data; the layout is rendered by the frontend.
 * compose*() are pure (no I/O) so they can be tested and used to generate
 * samples; build*() load from the database and call them.
 */

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * Institution details come from env: none of this is stored per bill, and
 * the guide requires institution-specific content (name, which banks the
 * institution actually holds collection accounts with).
 */
function readConfig(env = process.env) {
  const list = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

  return {
    institutionName: env.GEPG_SP_NAME || '',
    // Optional second heading line, e.g. the parent ministry.
    institutionSubtitle: env.GEPG_SP_SUBTITLE || '',
    collectionCentre: env.GEPG_COLLECTION_CENTRE_NAME || '',
    // GePG paybill number used in the QR "shortCode" (QR spec section 2).
    // Deliberately no default: a wrong paybill number in a QR would send
    // payers' money to the wrong place.
    qrShortCode: env.GEPG_QR_SHORT_CODE || '',
    // The guide says to list only banks the institution has collection
    // accounts with.
    banks: list(env.PRINT_BANKS),
    // Mobile money payment only works for TZS bills of institutions whose
    // collection account is with NMB (guide, section C(ii)).
    mobileMoney: String(env.PRINT_MOBILE_MONEY || 'true').toLowerCase() !== 'false',
    transfer: {
      beneficiaryName: env.GEPG_TRANSFER_BENEFICIARY_NAME || env.GEPG_SP_NAME || '',
      bankName: env.GEPG_TRANSFER_BANK_NAME || '',
      accountNumber: env.GEPG_TRANSFER_ACCOUNT_NUMBER || '',
      swiftCode: env.GEPG_TRANSFER_SWIFT_CODE || ''
    },
    // Logos are served by the frontend; paths are overridable.
    logos: {
      coatOfArms: env.PRINT_LOGO_COAT_OF_ARMS || '/images/gepg/coat-of-arms.png',
      gepg: env.PRINT_LOGO_GEPG || '/images/gepg/gepg-logo.png'
    }
  };
}

// ── Formatting helpers ───────────────────────────────────────────────────────

const TZ = 'Africa/Dar_es_Salaam';

/** 05-Apr-2019, the format used by every date in the GePG samples. */
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' })
    .format(d)
    .replace(/ /g, '-');
}

/** YYYY-MM-DD in Tanzania time, for the QR billExprDt field. */
function formatIsoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function itemDescription(item, gfsDescriptions) {
  const gfsText = gfsDescriptions[item.gfs_code] || item.gfs_code;
  return item.bill_item_ref ? `${gfsText} - ${item.bill_item_ref}` : gfsText;
}

// ── QR (GePG QR Code Specification v1.2) ─────────────────────────────────────

/**
 * Builds the GePG QR message. Mandatory: opType, shortCode, billReference,
 * amount. billPayOpt is only defined for 1-3 in the QR spec, so it is left
 * out for INFINITY/LIMITED (4/5) bills rather than sending an invalid value.
 * Returns null when the paybill short code is not configured.
 */
function buildQrPayload(bill, cfg) {
  if (!cfg.qrShortCode || !bill.payment_control_number) return null;

  const payload = {
    opType: '2', // Pay Bill
    shortCode: cfg.qrShortCode,
    billReference: String(bill.payment_control_number),
    amount: Number(bill.bill_amount).toFixed(2),
    billCcy: bill.currency || 'TZS',
    billExprDt: formatIsoDate(bill.bill_expiry_date)
  };

  const payOpt = Number(bill.bill_pay_option);
  if (payOpt >= 1 && payOpt <= 3) payload.billPayOpt = String(payOpt);

  // First two positions are reserved for institution and customer name.
  payload.billRsv01 = `${cfg.institutionName}|${bill.payer_name || ''}`;

  return payload;
}

/**
 * Renders the payload as a QR image (PNG data URL). Uses the optional
 * "qrcode" package; when it is not installed this returns null and the
 * document is still produced (the frontend shows the payload instead of an
 * image) rather than failing the whole print.
 */
async function qrToDataUrl(payload) {
  if (!payload) return null;

  let QRCode;
  try {
    QRCode = require('qrcode');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }

  return QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1, width: 280 });
}

// ── Document composition (pure) ──────────────────────────────────────────────

function paymentInstructions(bill, cfg) {
  const control = String(bill.payment_control_number);
  const mobileAvailable = cfg.mobileMoney && (bill.currency || 'TZS') === 'TZS';

  return {
    controlNumber: control,
    banks: cfg.banks,
    mobileMoney: mobileAvailable
  };
}

/**
 * Bill (Appendix 3) or transfer bill (Appendix 2) document.
 * type: 'bill' | 'transfer'
 */
function composeBillDocument({ bill, items, gfsDescriptions = {}, cfg, printedBy, now = new Date(), type = 'bill', qrPayload = null, qrImage = null }) {
  const warnings = [];
  if (!cfg.institutionName) warnings.push('GEPG_SP_NAME is not set - the institution name is missing from the heading.');
  if (!cfg.qrShortCode) warnings.push('GEPG_QR_SHORT_CODE is not set - no QR code can be generated.');
  else if (qrPayload && !qrImage) warnings.push('The "qrcode" package is not installed on the server - showing the QR message instead of an image.');
  if (type === 'bill' && cfg.banks.length === 0) warnings.push('PRINT_BANKS is not set - the bank payment instructions are generic.');

  const rows = items.map((item, i) => ({
    no: i + 1,
    description: itemDescription(item, gfsDescriptions),
    amount: money(item.bill_item_amount)
  }));

  const total = Number(bill.bill_amount);
  const currency = bill.currency || 'TZS';

  const document = {
    type,
    title: type === 'transfer' ? 'Order Form for Electronic Funds Transfer' : 'Government Bill',
    institution: {
      name: cfg.institutionName,
      subtitle: cfg.institutionSubtitle
    },
    logos: cfg.logos,
    bill: {
      controlNumber: String(bill.payment_control_number),
      paymentReference: bill.bill_description || bill.bill_id,
      billReference: bill.bill_id,
      serviceProviderCode: process.env.GEPG_SP_CODE || '',
      payerName: bill.payer_name,
      payerPhone: bill.payer_cell_num || '',
      description: bill.bill_description || '',
      items: rows,
      total: money(total),
      currency,
      amountInWords: amountInWords(total, currency),
      expiresOn: formatDate(bill.bill_expiry_date),
      preparedBy: bill.generated_by || '',
      collectionCentre: cfg.collectionCentre || bill.coll_cent_code || '',
      printedBy: printedBy || '',
      printedOn: formatDate(now)
    },
    qr: qrPayload ? { image: qrImage, payload: qrPayload, caption: 'SCAN & PAY by M-PESA or TIGO PESA APPs' } : null,
    payment: paymentInstructions(bill, cfg),
    warnings
  };

  if (type === 'transfer') {
    const t = cfg.transfer;
    document.transfer = {
      beneficiaryName: t.beneficiaryName,
      bankName: t.bankName,
      accountNumber: t.accountNumber,
      swiftCode: t.swiftCode,
      // MT103 fields exactly as the guide specifies (items 2 and 3 of the
      // TISS/SWIFT instructions): field 59 = beneficiary account, field 70 =
      // "/ROC/" + control number.
      field59: `/${t.accountNumber}`,
      field70: `/ROC/${bill.payment_control_number}`,
      beingPaymentFor: bill.bill_description || ''
    };
  }

  return document;
}

/** GePG receipt (Appendix 1). */
function composeReceiptDocument({ payment, bill, items, allPayments, gfsDescriptions = {}, cfg, issuedBy, now = new Date() }) {
  const warnings = [];
  if (!cfg.institutionName) warnings.push('GEPG_SP_NAME is not set - the institution name is missing from the heading.');

  const currency = payment.currency || bill.currency || 'TZS';
  const paid = Number(payment.paid_amount);
  const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const outstanding = Math.max(Number(bill.bill_amount) - totalPaid, 0);

  return {
    type: 'receipt',
    title: 'Exchequer Receipts',
    titleSw: 'Stakabadhi ya Malipo ya Serikali',
    institution: { name: cfg.institutionName, subtitle: cfg.institutionSubtitle },
    logos: cfg.logos,
    receipt: {
      // PayRefId is "Payment receipt issued by the GePG" (spec 6.2).
      receiptNumber: payment.pay_ref_id || '',
      receivedFrom: payment.payer_name || bill.payer_name,
      amount: money(paid),
      currency,
      amountInWords: amountInWords(paid, currency),
      outstandingBalance: money(outstanding),
      items: items.map(item => ({
        description: itemDescription(item, gfsDescriptions),
        amount: money(item.bill_item_amount)
      })),
      totalBilled: money(bill.bill_amount),
      billReference: bill.bill_id,
      controlNumber: String(payment.payment_control_number || bill.payment_control_number || ''),
      paymentDate: formatDate(payment.transaction_datetime),
      paymentChannel: payment.used_payment_channel || '',
      pspName: payment.psp_name || '',
      issuedBy: issuedBy || '',
      dateIssued: formatDate(now)
    },
    warnings
  };
}

// ── Loading (I/O) ────────────────────────────────────────────────────────────

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function loadGfsDescriptions(items) {
  const codes = [...new Set(items.map(i => i.gfs_code).filter(Boolean))];
  if (codes.length === 0) return {};

  const [rows] = await db.query('SELECT code, description FROM gfs_codes WHERE code IN (?)', [codes]);
  return Object.fromEntries(rows.map(r => [r.code, r.description]));
}

async function buildBillDocument(billId, { type = 'bill', printedBy } = {}) {
  if (!['bill', 'transfer'].includes(type)) {
    throw httpError(400, "type must be 'bill' or 'transfer'");
  }

  const bill = await Bill.findById(billId);
  if (!bill) throw httpError(404, 'Bill not found');

  // Without a control number there is nothing for the payer to pay against.
  if (!bill.payment_control_number) {
    throw httpError(409, `Bill has no control number yet (status ${bill.status}). It can be printed once GePG approves it.`);
  }

  const cfg = readConfig();

  if (type === 'transfer') {
    const t = cfg.transfer;
    const missing = [
      ['GEPG_TRANSFER_BANK_NAME', t.bankName],
      ['GEPG_TRANSFER_ACCOUNT_NUMBER', t.accountNumber],
      ['GEPG_TRANSFER_SWIFT_CODE', t.swiftCode]
    ].filter(([, v]) => !v).map(([k]) => k);

    if (missing.length > 0) {
      throw httpError(409, `Transfer bill is not configured: set ${missing.join(', ')}.`);
    }
  }

  const items = await BillItem.findByBillId(billId);
  const gfsDescriptions = await loadGfsDescriptions(items);

  const qrPayload = buildQrPayload(bill, cfg);
  const qrImage = await qrToDataUrl(qrPayload);

  return composeBillDocument({ bill, items, gfsDescriptions, cfg, printedBy, type, qrPayload, qrImage });
}

async function buildReceiptDocument(paymentId, { issuedBy } = {}) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw httpError(404, 'Payment not found');

  const bill = await Bill.findById(payment.bill_id);
  if (!bill) throw httpError(404, 'Bill for this payment not found');

  const items = await BillItem.findByBillId(bill.bill_id);
  const allPayments = await Payment.findByBillId(bill.bill_id);
  const gfsDescriptions = await loadGfsDescriptions(items);

  return composeReceiptDocument({ payment, bill, items, allPayments, gfsDescriptions, cfg: readConfig(), issuedBy });
}

module.exports = {
  readConfig,
  buildQrPayload,
  composeBillDocument,
  composeReceiptDocument,
  buildBillDocument,
  buildReceiptDocument,
  formatDate
};
