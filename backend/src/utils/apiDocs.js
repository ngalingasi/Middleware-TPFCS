// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Developer documentation: every endpoint and delivery detail, in one place
// └──────────────────────────────────────────────────────────────────────────┘

// The Developer page and every downloadable file (Markdown, OpenAPI, Postman,
// Insomnia) are generated from buildDocs(), so they cannot disagree. Run
// `npm run docs:check` after changing a route: it fails if a route and this
// list no longer match.

const {
  EVENT_TYPES, BACKOFF_SECONDS, TIMEOUT_MS, SIGNATURE_TOLERANCE_SECONDS, RETRY_WINDOWS, DEFAULT_RETRY_WINDOW, sign
} = require('./webhookConfig');
const { sampleEvent } = require('./eventPayloads');
const { listCodes } = require('./gepgCodes');

// fixed values for the signature test file: never a real secret
const EXAMPLE_SECRET = `whsec_${'0123456789abcdef'.repeat(4)}`;
const EXAMPLE_TIMESTAMP = 1763373731;

const DEFAULT_CODE = 'ICDV';
const DEFAULT_CALLBACK = 'https://billing.example.com/gepg/events';

const EVENT_INFO = {
  'bill.approved': 'GePG accepted the bill. It now has a control number the payer can use.',
  'bill.rejected': 'GePG refused the bill. reason.code and reason.description say why.',
  'payment.received': 'A payment arrived. It is also sent for a payment recovered by reconciliation (source is "reconciliation"). A bill paid in parts gives one of these per payment.',
  'bill.paid': 'The payments now cover the billed amount. Sent once, right after the payment.received that settled it.',
  'bill.cancelled': 'The bill was cancelled.',
  'bill.expired': 'An approved bill passed its expiry date without being fully paid. totals shows what is still due.',
  'system.test': 'Sent by the Test button on the Billing Systems page. Not part of the events feed.'
};

function duration(seconds) {
  if (seconds % 86400 === 0) return seconds === 86400 ? 'every 24 hours' : `${seconds / 86400} days`;
  if (seconds % 3600 === 0) return seconds === 3600 ? '1 hour' : `${seconds / 3600} hours`;
  return seconds === 60 ? '1 minute' : `${seconds / 60} minutes`;
}

function windowText(hours) {
  return hours >= 168 && hours % 24 === 0 ? `${hours / 24} days` : `${hours} hours`;
}

const VERIFY_SAMPLES = {
  node: `const crypto = require('crypto');

// rawBody must be the body exactly as received, before any JSON parsing
function verify(rawBody, header, secret) {
  const [, t, v1] = /t=(\\d+),v1=([0-9a-f]+)/.exec(header || '') || [];
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > ${SIGNATURE_TOLERANCE_SECONDS}) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + rawBody).digest('hex');
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`,
  php: `<?php
// $rawBody must be the body exactly as received: file_get_contents('php://input')
function verify(string $rawBody, string $header, string $secret): bool {
    if (!preg_match('/t=(\\d+),v1=([0-9a-f]+)/', $header, $m)) return false;
    if (abs(time() - (int)$m[1]) > ${SIGNATURE_TOLERANCE_SECONDS}) return false;
    return hash_equals(hash_hmac('sha256', $m[1] . '.' . $rawBody, $secret), $m[2]);
}`,
  python: `import hmac, hashlib, re, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    m = re.search(r"t=(\\d+),v1=([0-9a-f]+)", header or "")
    if not m or abs(time.time() - int(m.group(1))) > ${SIGNATURE_TOLERANCE_SECONDS}:
        return False
    expected = hmac.new(secret.encode(), m.group(1).encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, m.group(2))`
};

const RECEIVER_SAMPLES = {
  node: `const express = require('express');
const app = express();

// keep the raw body: the signature is computed over it
app.post('/gepg/events', express.raw({ type: 'application/json' }), (req, res) => {
  const raw = req.body.toString('utf8');
  if (!verify(raw, req.get('X-Bridge-Signature'), process.env.BRIDGE_SECRET)) return res.sendStatus(401);

  const event = JSON.parse(raw);
  res.sendStatus(200);          // answer first, then do the work
  handle(event);                // ignore event.id values you have already handled
});`,
  php: `<?php
$raw = file_get_contents('php://input');
if (!verify($raw, $_SERVER['HTTP_X_BRIDGE_SIGNATURE'] ?? '', getenv('BRIDGE_SECRET'))) {
    http_response_code(401);
    exit;
}

$event = json_decode($raw, true);
http_response_code(200);        // answer first, then do the work
echo '{"received":true}';
// ... handle($event); ignore event ids you have already handled`,
  python: `from flask import Flask, request
import os

app = Flask(__name__)

@app.post("/gepg/events")
def gepg_events():
    raw = request.get_data()    # the raw body: the signature is computed over it
    if not verify(raw, request.headers.get("X-Bridge-Signature"), os.environ["BRIDGE_SECRET"]):
        return "", 401
    event = request.get_json()
    # answer first, then do the work; ignore event ids you have already handled
    return {"received": True}, 200`
};

function testVector(code = DEFAULT_CODE) {
  const body = JSON.stringify(sampleEvent('payment.received', { code }));
  return {
    secret: EXAMPLE_SECRET,
    timestamp: EXAMPLE_TIMESTAMP,
    body,
    signedText: `${EXAMPLE_TIMESTAMP}.${body}`,
    signature: sign(EXAMPLE_SECRET, EXAMPLE_TIMESTAMP, body),
    header: `t=${EXAMPLE_TIMESTAMP},v1=${sign(EXAMPLE_SECRET, EXAMPLE_TIMESTAMP, body)}`
  };
}

function buildDocs({ baseUrl = 'https://bridge.example.com', system = null } = {}) {
  const code = system ? system.code : DEFAULT_CODE;
  const callbackUrl = (system && system.callback_url) || DEFAULT_CALLBACK;
  const gepgId = (ref) => `${code}-${ref}`;
  const url = (path) => `${baseUrl}${path}`;

  const ack = {
    ok: true, code: '7101', description: 'Successful',
    codes: [{ code: '7101', description: 'Successful' }]
  };
  const gepgAck = { billSubReqAck: { AckId: 'GW1763373731000', ReqId: 'SP0231763373731000', AckStsCode: '7101', AckStsDesc: 'Successful' } };
  const pagination = { page: 1, limit: 20, total: 1, pages: 1 };

  const billBody = {
    billId: 'INV-1001',
    billAmount: 500000,
    billEquivAmount: 500000,
    billExpiryDate: '2027-12-17T12:00:00',
    payerId: 'P1001',
    payerName: 'Vidah Mwakyusa',
    payerCellNumber: '255786030028',
    payerEmail: 'vidah@example.com',
    billDescription: 'Sale of tender document',
    currency: 'TZS',
    billPayOption: 2,
    items: [{ billItemRef: 'TND-77', billItemAmount: 500000, billItemEquivAmount: 500000, gfsCode: '140368' }]
  };

  const billFields = [
    { name: 'billId', type: 'string', required: true, description: `Your own reference for the bill, unique within your system (at most 87 characters). GePG knows it as "${code}-<billId>".`, example: 'INV-1001' },
    { name: 'billAmount', type: 'number', required: true, description: 'Total to pay. Must be greater than zero and equal to the total of the item amounts.', example: 500000 },
    { name: 'billEquivAmount', type: 'number', required: true, description: 'The total in TZS. Same as billAmount for TZS bills.', example: 500000 },
    { name: 'billExpiryDate', type: 'string (ISO 8601)', required: true, description: 'After this the bill can no longer be paid.', example: '2027-12-17T12:00:00' },
    { name: 'payerId', type: 'string', required: true, description: 'Your identifier for the payer.', example: 'P1001' },
    { name: 'payerName', type: 'string', required: true, description: 'Name of the payer.', example: 'Vidah Mwakyusa' },
    { name: 'payerCellNumber', type: 'string', required: false, description: 'Payer phone, 12 digits with the country code.', example: '255786030028' },
    { name: 'payerEmail', type: 'string', required: false, description: 'Payer email address.', example: 'vidah@example.com' },
    { name: 'billDescription', type: 'string', required: false, description: 'What the bill is for. Printed on the bill.', example: 'Sale of tender document' },
    { name: 'currency', type: 'string', required: false, description: 'Currency code. Defaults to TZS.', example: 'TZS' },
    { name: 'billPayOption', type: 'integer', required: false, description: 'How the bill may be paid: 1 full, 2 partial (instalments), 3 exact amount only, 4 any amount, 5 limited. Defaults to 1.', example: 2 },
    { name: 'items', type: 'array', required: true, description: 'At least one item.', example: '[ ... ]' },
    { name: 'items[].billItemRef', type: 'string', required: true, description: 'Your reference for the item.', example: 'TND-77' },
    { name: 'items[].billItemAmount', type: 'number', required: true, description: 'Item amount, greater than zero.', example: 500000 },
    { name: 'items[].billItemEquivAmount', type: 'number', required: true, description: 'Item amount in TZS.', example: 500000 },
    { name: 'items[].gfsCode', type: 'string', required: true, description: 'The revenue code (GFS code). It must be on the bridge\'s active GFS list.', example: '140368' },
    { name: 'custTin, custIdTyp, custAccnt, collCentCode, minPayAmt, exchRate, payPlan, payLimTyp, payLimAmt, collPsp', type: 'various', required: false, description: 'Other GePG v5 bill fields, passed through when you need them (custIdTyp: 1 national ID, 2 driver\'s licence, 3 tax ID, 4 wallet number).', example: '' }
  ];

  const billRow = {
    id: 1, bill_id: gepgId('INV-1001'), external_ref: 'INV-1001', billing_system_code: code,
    payer_id: 'P1001', payer_name: 'Vidah Mwakyusa', payer_cell_num: '255786030028', bill_description: 'Sale of tender document',
    bill_amount: '500000.00', currency: 'TZS', bill_pay_option: 2, bill_expiry_date: '2027-12-17T09:00:00.000Z',
    payment_control_number: '991330026625', status: 'APPROVED', transaction_status: 'GS', transaction_status_code: '7101',
    created_at: '2026-11-16T09:30:00.000Z', item_count: 1
  };
  // the single-bill response has no item_count (only the list does)
  const { item_count: itemCount, ...detailRow } = billRow;
  const itemRow = { id: 1, bill_id: gepgId('INV-1001'), bill_item_ref: 'TND-77', gfs_code: '140368', bill_item_amount: '500000.00', bill_item_equiv_amount: '500000.00' };
  const paymentRow = {
    id: 12, transaction_id: 'T1001', pay_ref_id: '99015046706', bill_id: gepgId('INV-1001'), payment_control_number: '991330026625',
    bill_amount: '500000.00', paid_amount: '300000.00', currency: 'TZS', transaction_datetime: '2026-11-16T09:35:00.000Z',
    used_payment_channel: 'MB', psp_name: 'Example Bank', payment_type: 'OFFLINE', status: 'PENDING'
  };

  const err = (status, title, body) => ({ status, title, body });
  const e401 = err(401, 'Missing or wrong API key', { success: false, message: 'Invalid or disabled API key' });
  const e403 = err(403, 'Key not linked to an active billing system', { success: false, message: 'This API key is not linked to a billing system. Ask an admin to link it.' });
  const e404Bill = err(404, 'No such bill among your bills', { success: false, code: '7204', message: 'Bill not found' });
  const validationError = err(400, 'A value is not valid', {
    success: false, code: '7242', message: 'Bill amount must be a number greater than zero',
    errors: [{ type: 'field', value: 0, msg: 'Bill amount must be a number greater than zero', path: 'billAmount', location: 'body' }]
  });
  const refused = (what) => err(422, `GePG refused the ${what}`, {
    success: false, code: '7242', codes: [{ code: '7242', description: 'Invalid request data' }],
    message: `GePG rejected the ${what}: Invalid request data`, data: { billSubReqAck: { AckStsCode: '7242', AckStsDesc: 'Invalid request data' } }
  });
  const billParam = { name: 'billId', in: 'path', required: true, description: 'Your own reference for the bill (the billId you sent when creating it).', example: 'INV-1001' };

  const groups = [
    {
      id: 'start', title: 'Connection check', description: 'Confirm your key and system code work.',
      endpoints: [{
        id: 'ping', method: 'GET', path: '/api/v1/ping', title: 'Check the connection',
        summary: 'Returns the billing system your API key belongs to. Use it as the first call when setting up.',
        responses: [
          { status: 200, title: 'Key is valid', body: { success: true, data: { system: code, name: system ? system.name : 'ICDV Management', serverTime: '2026-11-16T09:30:00.000Z' } } },
          e401, e403
        ]
      }]
    },
    {
      id: 'bills', title: 'Bills', description: 'Create bills, check them, and change them.',
      endpoints: [
        {
          id: 'createBill', method: 'POST', path: '/api/v1/bills', title: 'Create a bill and send it to GePG',
          summary: 'Saves the bill and sends it to GePG. GePG answers in two steps: an immediate acknowledgement (this response) and, a moment later, the control number as a bill.approved event.',
          notes: ['A 201 means GePG received the bill, not that it approved it. Wait for the bill.approved or bill.rejected event, or check the status.'],
          body: { description: 'JSON body.', fields: billFields, example: billBody },
          responses: [
            { status: 201, title: 'Created and received by GePG', body: { success: true, message: 'Bill created and submitted successfully', ack, data: gepgAck, bill: { billId: 'INV-1001', gepgBillId: gepgId('INV-1001') } } },
            validationError,
            err(409, 'You already used this billId', { success: false, code: '7226', message: 'A bill with this billId already exists' }),
            refused('bill'), e401, e403
          ]
        },
        {
          id: 'bulkBills', method: 'POST', path: '/api/v1/bills/bulk', title: 'Create many bills at once',
          summary: 'Up to 100 bills. Each is checked and sent on its own, so one bad bill does not stop the others. The response lists the result of every bill.',
          body: { description: 'JSON body with a list of bills, each shaped like a single bill.', fields: [{ name: 'bills', type: 'array', required: true, description: 'Between 1 and 100 bills.', example: '[ ... ]' }], example: { bills: [billBody, { ...billBody, billId: 'INV-1002', payerName: 'Amani Juma' }] } },
          responses: [
            { status: 200, title: 'Processed (check each result)', body: { success: true, message: '2 of 2 bills submitted to GePG', summary: { total: 2, succeeded: 2, failed: 0 }, results: [{ billId: 'INV-1001', success: true, code: '7101', message: 'Submitted to GePG' }, { billId: 'INV-1002', success: true, code: '7101', message: 'Submitted to GePG' }] } },
            err(400, 'Empty list or more than 100', { success: false, code: '7242', message: 'bills must be a non-empty array' }), e401, e403
          ]
        },
        {
          id: 'reuseBill', method: 'POST', path: '/api/v1/bills/reuse', title: 'Reuse a control number',
          summary: 'Issue a new bill under a control number you were given earlier, for example after the first bill was paid or expired. Same body as creating a bill, plus the old control number and a reason.',
          body: { description: 'Same fields as creating a bill, plus:', fields: [
            { name: 'paymentControlNumber', type: 'string', required: true, description: 'The control number to reuse. It must have been issued to your system.', example: '991330026625' },
            { name: 'reuseReason', type: 'string', required: true, description: 'Why it is being reused.', example: 'Billed amount adjustment' }
          ], example: { ...billBody, billId: 'INV-1003', paymentControlNumber: '991330026625', reuseReason: 'Billed amount adjustment' } },
          responses: [
            { status: 201, title: 'Created and received by GePG', body: { success: true, message: 'Control number reuse submitted to GePG', ack, data: gepgAck, bill: { billId: 'INV-1003', gepgBillId: gepgId('INV-1003') } } },
            err(404, 'That control number was not issued to your system', { success: false, code: '7335', message: 'Requested bill control number does not exist' }),
            validationError, refused('reuse request'), e401, e403
          ]
        },
        {
          id: 'billStatuses', method: 'POST', path: '/api/v1/bills/status', title: 'Check many bills at once',
          summary: 'Status, control number and amount paid for up to 100 bills in one call. References that are not yours or do not exist are listed in notFound.',
          body: { description: 'JSON body.', fields: [{ name: 'billIds', type: 'array of string', required: true, description: 'Between 1 and 100 of your own references.', example: '["INV-1001", "INV-1002"]' }], example: { billIds: ['INV-1001', 'INV-1002'] } },
          responses: [
            { status: 200, title: 'Found and not found', body: { success: true, data: { bills: [{ billId: 'INV-1001', gepgBillId: gepgId('INV-1001'), status: 'APPROVED', controlNumber: '991330026625', billAmount: 500000, currency: 'TZS', totalPaid: 300000, remaining: 200000, isPaid: false, expiresAt: '2027-12-17T09:00:00.000Z' }], notFound: ['INV-1002'] } } },
            err(400, 'Empty list or more than 100', { success: false, code: '7242', message: 'billIds must be a list of 1 to 100 bill references' }), e401, e403
          ]
        },
        {
          id: 'listBills', method: 'GET', path: '/api/v1/bills', title: 'List your bills',
          summary: 'Newest first, 20 per page by default. Only your own bills are returned. Amounts in bill rows are strings with two decimals.',
          params: [
            { name: 'page', in: 'query', required: false, description: 'Page number, starting at 1.', example: '1' },
            { name: 'limit', in: 'query', required: false, description: 'Bills per page.', example: '20' },
            { name: 'status', in: 'query', required: false, description: 'PENDING, APPROVED, REJECTED, PAID, CANCELLED or EXPIRED.', example: 'APPROVED' },
            { name: 'controlNumber', in: 'query', required: false, description: 'Only the bill with this control number.', example: '991330026625' },
            { name: 'startDate', in: 'query', required: false, description: 'Created on or after (YYYY-MM-DD). Use with endDate.', example: '2026-11-01' },
            { name: 'endDate', in: 'query', required: false, description: 'Created on or before (YYYY-MM-DD).', example: '2026-11-30' }
          ],
          responses: [{ status: 200, title: 'A page of bills (trimmed)', body: { success: true, data: [billRow], pagination } }, e401, e403]
        },
        {
          id: 'getBill', method: 'GET', path: '/api/v1/bills/{billId}', title: 'Get one bill',
          summary: 'The bill with its items and payments, and how much is paid and still due.',
          params: [billParam],
          responses: [
            { status: 200, title: 'The bill (trimmed)', body: { success: true, data: { ...detailRow, items: [itemRow], payments: [paymentRow], isPaid: false, totalPaid: 300000, remainingAmount: 200000 } } },
            e404Bill, e401, e403
          ]
        },
        {
          id: 'getBillStatus', method: 'GET', path: '/api/v1/bills/{billId}/status', title: 'Is this bill paid?',
          summary: 'A light check you can poll. isPaid is true only when payments cover the whole amount; remainingAmount says how much is still due.',
          params: [billParam],
          responses: [
            { status: 200, title: 'Status', body: { success: true, data: { billId: 'INV-1001', gepgBillId: gepgId('INV-1001'), status: 'APPROVED', paymentControlNumber: '991330026625', transactionStatus: 'GS', transactionStatusCode: '7101', isPaid: false, totalPaid: 300000, remainingAmount: 200000 } } },
            e404Bill, e401, e403
          ]
        },
        {
          id: 'extendBill', method: 'POST', path: '/api/v1/bills/{billId}/extend', title: 'Extend the expiry date',
          summary: 'Gives an approved bill more time. The control number stays the same. The new date must be in the future and later than the current one.',
          params: [billParam],
          body: { description: 'JSON body.', fields: [
            { name: 'billExpiryDate', type: 'string (ISO 8601)', required: true, description: 'The new expiry date.', example: '2028-01-31T12:00:00' },
            { name: 'reason', type: 'string', required: true, description: 'Why it is being extended.', example: 'Customer asked for more time' }
          ], example: { billExpiryDate: '2028-01-31T12:00:00', reason: 'Customer asked for more time' } },
          responses: [
            { status: 200, title: 'Change received by GePG', body: { success: true, message: 'Bill expiry change submitted to GePG', ack, data: gepgAck } },
            err(400, 'Not an approved bill, or the date is not later', { success: false, code: '7231', message: 'New expiry date must be in the future and later than the current expiry date' }),
            refused('expiry change'), e404Bill, e401, e403
          ]
        },
        {
          id: 'cancelBill', method: 'POST', path: '/api/v1/bills/{billId}/cancel', title: 'Cancel a bill',
          summary: 'Cancels a bill that has not been paid in full. You get a bill.cancelled event.',
          params: [billParam],
          body: { description: 'JSON body.', fields: [{ name: 'reason', type: 'string', required: true, description: 'Why it is being cancelled.', example: 'Duplicate bill' }], example: { reason: 'Duplicate bill' } },
          responses: [
            { status: 200, title: 'Cancelled', body: { success: true, message: 'Bill cancelled successfully', data: { billCanclRes: { ResId: 'GW1763373731001', ReqId: 'SP0231763373731001', GrpBillId: gepgId('INV-1001'), CanclSts: 'GS', CanclStsCode: '7283', CanclStsDesc: 'Bill has been cancelled' } } } },
            err(400, 'The bill cannot be cancelled in its current state', { success: false, message: 'Bill not found or cannot be cancelled' }),
            err(502, 'GePG declined the cancellation', { success: false, code: '7201', message: 'GePG declined the cancellation', data: { billCanclRes: { CanclSts: 'GF', CanclStsCode: '7201' } } }),
            e404Bill, e401, e403
          ]
        },
        {
          id: 'printBill', method: 'GET', path: '/api/v1/bills/{billId}/print', title: 'Data for a printable bill',
          summary: 'Everything needed to print the bill: control number, items, amount in words, payment instructions and the QR message. Only available once the bill has a control number. Add ?type=transfer for the bank-transfer form.',
          params: [billParam, { name: 'type', in: 'query', required: false, description: 'bill (default) or transfer.', example: 'bill' }],
          responses: [
            { status: 200, title: 'Print data (trimmed)', body: { success: true, data: { type: 'bill', title: 'Government Bill', bill: { controlNumber: '991330026625', billReference: gepgId('INV-1001'), payerName: 'Vidah Mwakyusa', total: '500,000.00', currency: 'TZS', amountInWords: 'Five Hundred Thousand Tanzanian Shilling Only.', expiresOn: '17-Dec-2027' }, qr: { payload: { opType: '2', shortCode: '001001', billReference: '991330026625', amount: '500000.00' } }, warnings: [] } } },
            err(409, 'Not approved yet', { success: false, message: 'Bill has no control number yet (status PENDING). It can be printed once GePG approves it.' }),
            e404Bill, e401, e403
          ]
        }
      ]
    },
    {
      id: 'payments', title: 'Payments', description: 'Payments received on your bills.',
      endpoints: [
        {
          id: 'listPayments', method: 'GET', path: '/api/v1/payments', title: 'List payments',
          summary: 'Payments on your own bills, newest first.',
          params: [
            { name: 'page', in: 'query', required: false, description: 'Page number, starting at 1.', example: '1' },
            { name: 'limit', in: 'query', required: false, description: 'Payments per page.', example: '20' },
            { name: 'billId', in: 'query', required: false, description: 'Only payments on this bill (your own reference).', example: 'INV-1001' },
            { name: 'startDate', in: 'query', required: false, description: 'Paid on or after (YYYY-MM-DD). Use with endDate.', example: '2026-11-01' },
            { name: 'endDate', in: 'query', required: false, description: 'Paid on or before (YYYY-MM-DD).', example: '2026-11-30' }
          ],
          responses: [{ status: 200, title: 'A page of payments (trimmed)', body: { success: true, data: [paymentRow], pagination } }, e401, e403]
        },
        {
          id: 'getPayment', method: 'GET', path: '/api/v1/payments/{paymentId}', title: 'Get one payment',
          summary: 'One payment on your bills.',
          params: [{ name: 'paymentId', in: 'path', required: true, description: 'The payment id from the list or an event.', example: '12' }],
          responses: [
            { status: 200, title: 'The payment (trimmed)', body: { success: true, data: paymentRow } },
            err(404, 'Not found among your payments', { success: false, message: 'Payment not found' }), e401, e403
          ]
        },
        {
          id: 'paymentReceipt', method: 'GET', path: '/api/v1/payments/{paymentId}/receipt', title: 'Data for a printable receipt',
          summary: 'Everything needed to print the GePG receipt for a payment.',
          params: [{ name: 'paymentId', in: 'path', required: true, description: 'The payment id.', example: '12' }],
          responses: [
            { status: 200, title: 'Receipt data (trimmed)', body: { success: true, data: { type: 'receipt', title: 'Exchequer Receipts', receipt: { receiptNumber: '99015046706', receivedFrom: 'Vidah Mwakyusa', amount: '300,000.00', currency: 'TZS', amountInWords: 'Three Hundred Thousand Tanzanian Shilling Only.', outstandingBalance: '200,000.00', controlNumber: '991330026625', paymentDate: '16-Nov-2026' } } } },
            err(404, 'Not found among your payments', { success: false, message: 'Payment not found' }), e401, e403
          ]
        }
      ]
    },
    {
      id: 'events', title: 'Events feed', description: 'The same events that are sent to your callback URL, for you to collect.',
      endpoints: [{
        id: 'getEvents', method: 'GET', path: '/api/v1/events', title: 'Collect your events',
        summary: 'Your events in order, oldest first. Keep the nextCursor of the last batch you processed and ask for what came after it. Use this to catch up after downtime, or as your whole integration if you have no callback URL.',
        params: [
          { name: 'after', in: 'query', required: false, description: 'Cursor: only events after this one. Start with 0.', example: '0' },
          { name: 'limit', in: 'query', required: false, description: 'Events per call, 1 to 500. Defaults to 100.', example: '100' }
        ],
        responses: [
          { status: 200, title: 'Events and the next cursor', body: { success: true, data: { events: [sampleEvent('bill.approved', { code, id: 183 }), sampleEvent('payment.received', { code, id: 184 })], nextCursor: '184' } } },
          e401, e403
        ]
      }]
    }
  ];

  const sample = (type) => sampleEvent(type, { code });
  const vector = testVector(code);
  const compact = JSON.stringify(sample('payment.received'));
  const headersFor = (type, id) => ({
    'Content-Type': 'application/json',
    'User-Agent': 'GePG-Bridge/1.0',
    'X-Bridge-Event': type,
    'X-Bridge-Event-Id': String(id),
    'X-Bridge-Delivery-Attempt': '1',
    'X-Bridge-Timestamp': String(EXAMPLE_TIMESTAMP)
  });
  const sampleRequestText = [
    `POST ${callbackUrl} HTTP/1.1`,
    ...Object.entries({ ...headersFor('payment.received', 184), 'X-Bridge-Signature': vector.header }).map(([k, v]) => `${k}: ${v}`),
    '',
    compact
  ].join('\n');

  return {
    title: 'GePG Bridge: billing system API',
    baseUrl,
    system: system ? { code: system.code, name: system.name, callbackUrl } : null,
    code,

    gettingStarted: [
      { title: 'An admin adds your system', text: `On the Billing Systems page: your code (for example ${DEFAULT_CODE}), an optional callback URL, and a retry window.` },
      { title: 'Copy the signing secret', text: 'It is shown once. Your system uses it to check that deliveries really come from the bridge.' },
      { title: 'Get an API key', text: 'Created under Keys for your system, shown once. A key belongs to one system and only ever sees that system\'s bills and payments.' },
      { title: 'Check the connection', text: `Call GET ${url('/api/v1/ping')} with your key. It answers with your system code.` },
      { title: 'Send a bill, then listen', text: `POST a bill. GePG gives the control number a moment later, as a bill.approved event at your callback URL or in the events feed.` }
    ],

    authentication: {
      header: 'X-Api-Key',
      text: 'Send your API key in the X-Api-Key header on every call. Keys are issued per billing system.',
      rules: [
        'A key only sees its own system\'s bills and payments. Asking for anything else answers 404, as if it did not exist.',
        'Bill ids are yours: you send INV-1001; GePG sees ' + gepgId('INV-1001') + '. Responses give both (billId and gepgBillId).',
        'A disabled billing system\'s key answers 403 until an admin enables it again.',
        'Reconciliation with GePG is done by the bridge, not by billing systems. Recovered payments reach you as normal payment.received events.'
      ]
    },

    groups: groups.map((g) => ({
      ...g,
      endpoints: g.endpoints.map((e) => ({ ...e, group: g.id, url: url(e.path) }))
    })),

    events: EVENT_TYPES.map((type) => ({
      type,
      when: EVENT_INFO[type],
      sample: sample(type),
      sampleText: JSON.stringify(sample(type), null, 2)
    })),

    delivery: {
      summary: `The bridge sends each event to your callback URL as a POST with a JSON body. Answer with any 2xx status to confirm.`,
      callbackUrl,
      headers: [
        { name: 'Content-Type', description: 'Always application/json.', example: 'application/json' },
        { name: 'User-Agent', description: 'Identifies the sender.', example: 'GePG-Bridge/1.0' },
        { name: 'X-Bridge-Event', description: 'The event type.', example: 'payment.received' },
        { name: 'X-Bridge-Event-Id', description: 'The event number. The same event can arrive more than once, so remember the ids you have handled.', example: '184' },
        { name: 'X-Bridge-Delivery-Attempt', description: '1 for the first try, 2 for the first retry, and so on.', example: '1' },
        { name: 'X-Bridge-Timestamp', description: 'When this attempt was signed, in unix seconds.', example: String(EXAMPLE_TIMESTAMP) },
        { name: 'X-Bridge-Signature', description: 'How to check the sender: t=<timestamp>,v1=<signature>. See "Check the signature".', example: vector.header }
      ],
      verify: {
        steps: [
          'Read the raw body exactly as received, before any JSON parsing.',
          'Take t and v1 from the X-Bridge-Signature header.',
          `Reject the delivery if t is more than ${SIGNATURE_TOLERANCE_SECONDS / 60} minutes away from your clock. This stops someone replaying an old delivery.`,
          'Compute HMAC-SHA256 over the text "<t>.<raw body>" with your signing secret, as lowercase hex.',
          'Compare it with v1 in constant time. If they differ, reject the delivery (answer 401).'
        ],
        samples: VERIFY_SAMPLES,
        receiverSamples: RECEIVER_SAMPLES
      },
      testVector: {
        description: 'Check your verification code against this before connecting anything. It uses a fixed example secret and a fixed timestamp, so skip the 5-minute clock check for this one test.',
        ...vector
      },
      sampleRequest: { text: sampleRequestText, headers: { ...headersFor('payment.received', 184), 'X-Bridge-Signature': vector.header }, body: compact, bodyPretty: JSON.stringify(sample('payment.received'), null, 2) },
      sampleResponses: [
        { status: 200, title: 'Accepted (this is all that is needed)', text: 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"received":true}', result: 'Delivered. The body is ignored; any 2xx works.' },
        { status: 204, title: 'Accepted, no body', text: 'HTTP/1.1 204 No Content', result: 'Delivered.' },
        { status: 401, title: 'Signature did not match', text: 'HTTP/1.1 401 Unauthorized', result: 'Not delivered. The bridge tries again later.' },
        { status: 500, title: 'Your system failed', text: 'HTTP/1.1 500 Internal Server Error', result: 'Not delivered. The bridge tries again later.' }
      ],
      failures: [
        'Any status outside 200 to 299, including 3xx redirects (the bridge does not follow them) and 4xx errors.',
        `No answer within ${TIMEOUT_MS / 1000} seconds.`,
        'The connection cannot be made (server down, wrong address, certificate problem).'
      ],
      retries: {
        schedule: BACKOFF_SECONDS.map((s, i) => ({ afterAttempt: i + 1, wait: duration(s) })),
        scheduleText: `${BACKOFF_SECONDS.slice(0, -1).map(duration).join(', ')}, then ${duration(BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1])}`,
        windows: RETRY_WINDOWS.map((h) => ({ hours: h, text: windowText(h), default: h === DEFAULT_RETRY_WINDOW })),
        text: `The bridge keeps trying until the system's retry window ends (an admin picks 24 hours to 14 days; ${DEFAULT_RETRY_WINDOW} hours by default). The last try is made at the end of the window. After that the event shows as Failed in the Outbox, and an admin can send it again.`
      },
      rules: [
        'Delivery is at least once: the same event can arrive twice. Remember the event ids you have handled.',
        'Events are not guaranteed to arrive in order. Use the event id (it only grows) or createdAt if order matters.',
        'Answer quickly, then do the work: a slow answer counts as a failure after ' + (TIMEOUT_MS / 1000) + ' seconds.',
        'If you were down, collect what you missed from the events feed (GET /api/v1/events?after=...).'
      ]
    },

    errors: {
      http: [
        { status: 200, meaning: 'Done.' },
        { status: 201, meaning: 'Created. For a bill this means GePG received it; the control number follows as an event.' },
        { status: 400, meaning: 'A value is not valid. code and message say which; errors lists each field.' },
        { status: 401, meaning: 'No API key, or the key is wrong or deleted.' },
        { status: 403, meaning: 'The key is not linked to a billing system, or the system is disabled.' },
        { status: 404, meaning: 'No such bill or payment among yours (also when it belongs to another system).' },
        { status: 409, meaning: 'You already used this billId.' },
        { status: 422, meaning: 'GePG refused the request. code and codes say why (see the GePG codes).' },
        { status: 502, meaning: 'GePG declined a cancellation.' },
        { status: 500, meaning: 'The bridge failed. Try again; tell an admin if it keeps happening.' }
      ],
      codesNote: 'The code in an error response is a GePG response code. Common ones: 7242 invalid request data, 7223 invalid GFS code, 7226 duplicate bill, 7204 bill does not exist, 7231 wrong expiry date.',
      gepgCodes: listCodes()
    }
  };
}

module.exports = { buildDocs, testVector, EXAMPLE_SECRET, EXAMPLE_TIMESTAMP };
