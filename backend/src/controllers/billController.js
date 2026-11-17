// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Bill controller
// └──────────────────────────────────────────────────────────────────────────┘

const { validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Payment = require('../models/Payment');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');
const { ACK, gepgError, ackCodeFor, httpStatusFor } = require('../utils/gepgErrors');
const GfsCode = require('../models/GfsCode');
const { describeCode, describeCodes } = require('../utils/gepgCodes');

async function createBill(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, code: '7242', message: errors.array()[0].msg, errors: errors.array() });
    }

    const result = await Bill.create({ ...req.body, generatedBy: actorName(req) }, req.body.items || []);
    res.status(201).json({ success: true, message: 'Bill created successfully', data: result });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Shared helper: load a bill + its items and shape them into the payload gepgClient/xmlBuilder expect
async function loadBillDataForSubmission(billId, actor) {
  const bill = await Bill.findById(billId);
  if (!bill) {
    throw new Error('Bill not found');
  }

  const items = await BillItem.findByBillId(billId);

  return {
    billId: bill.bill_id,
    billAmount: bill.bill_amount,
    miscAmount: bill.misc_amount,
    billExpiryDate: formatDateTime(bill.bill_expiry_date),
    payerId: bill.payer_id,
    payerName: bill.payer_name,
    payerCellNumber: bill.payer_cell_num,
    payerEmail: bill.payer_email,
    billDescription: bill.bill_description,
    billGeneratedDate: formatDateTime(bill.created_at),
    // BillGenBy / BillApprBy are String(30) in the spec
    billGeneratedBy: actor || 'SYSTEM',
    billApprovedBy: actor || 'SYSTEM',
    currency: bill.currency,
    billEquivAmount: bill.bill_equiv_amount,
    billPayOption: bill.bill_pay_option,
    // v5 fields the create form doesn't collect yet; xmlBuilder defaults apply when null
    custTin: bill.cust_tin,
    custIdTyp: bill.cust_id_typ,
    custAccnt: bill.cust_accnt,
    collCentCode: bill.coll_cent_code,
    minPayAmt: bill.min_pay_amt,
    exchRate: bill.exch_rate,
    payPlan: bill.pay_plan,
    payLimTyp: bill.pay_lim_typ,
    payLimAmt: bill.pay_lim_amt,
    collPsp: bill.coll_psp,
    items: items.map(item => ({
      billItemRef: item.bill_item_ref,
      useItemRefOnPay: item.use_item_ref_on_pay,
      billItemAmount: item.bill_item_amount,
      billItemEquivAmount: item.bill_item_equiv_amount,
      billItemMiscAmount: item.bill_item_misc_amount,
      gfsCode: item.gfs_code,
      refBillId: item.ref_bill_id,
      collSp: item.coll_sp
    }))
  };
}

function actorName(req) {
  const name = (req.user && req.user.username) || (req.apiKey && req.apiKey.name) || 'SYSTEM';
  return String(name).slice(0, 30);
}

// Interpret GePG's immediate acknowledgement (billSubReqAck) and record it
async function recordSubmissionAck(billId, response) {
  const ack = response && response.billSubReqAck;
  if (!ack) {
    return { ok: true, code: null, description: null };
  }

  const code = String(ack.AckStsCode || '');
  await Bill.markSubmitted(billId, code);

  const codes = code.split(';').map(c => c.trim()).filter(Boolean);
  const ok = codes.length > 0 && codes.every(c => c === '7101');

  if (!ok && !codes.includes('7226')) {
    await Bill.markRejectedByAck(billId, code);
  }

  return {
    ok,
    code,
    description: ack.AckStsDesc || describeCodes(code).map(c => c.description).join('; '),
    codes: describeCodes(code)
  };
}

function ackFailureBody(ack, response) {
  return {
    success: false,
    code: ack.code,
    codes: ack.codes,
    message: ack.description || 'GePG did not accept the request',
    data: response
  };
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toISOString().replace(/\.\d{3}Z$/, '');
}

async function submitBill(req, res) {
  const { billId } = req.params;

  try {
    const billData = await loadBillDataForSubmission(billId, actorName(req));
    const response = await gepgClient.submitBill(billData);

    const ack = await recordSubmissionAck(billId, response);
    if (!ack.ok) {
      return res.status(422).json(ackFailureBody(ack, response));
    }

    res.json({ success: true, message: 'Bill submitted to GePG successfully', ack, data: response });
  } catch (error) {
    console.error('Submit bill error:', error);
    await Bill.markSubmissionFailed(billId, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function createAndSubmit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, code: '7242', message: errors.array()[0].msg, errors: errors.array() });
    }

    await Bill.create({ ...req.body, generatedBy: actorName(req) }, req.body.items || []);

    const billData = await loadBillDataForSubmission(req.body.billId, actorName(req));
    const response = await gepgClient.submitBill(billData);

    const ack = await recordSubmissionAck(req.body.billId, response);
    if (!ack.ok) {
      // the bill is kept (as REJECTED) so it can be fixed and resubmitted
      return res.status(422).json({
        ...ackFailureBody(ack, response),
        message: `Bill created but GePG rejected it: ${ack.description || ack.code}`
      });
    }

    res.status(201).json({ success: true, message: 'Bill created and submitted successfully', ack, data: response });
  } catch (error) {
    console.error('Create and submit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function cancelBill(req, res) {
  try {
    const { billId } = req.params;
    const { reason } = req.body;

    const bill = await Bill.findCancellable(billId);
    if (!bill) {
      return res.status(400).json({ success: false, message: 'Bill not found or cannot be cancelled' });
    }

    // cancellation is synchronous: the response is the billCanclRes
    const response = await gepgClient.cancelBill(billId, reason, actorName(req));
    const canclRes = response.billCanclRes;

    if (canclRes && canclRes.CanclSts !== 'GS') {
      return res.status(502).json({
        success: false,
        code: canclRes.CanclStsCode,
        message: canclRes.CanclStsDesc || describeCode(canclRes.CanclStsCode) || 'GePG declined the cancellation',
        data: response
      });
    }

    await Bill.markCancelled(billId);

    res.json({ success: true, message: 'Bill cancelled successfully', data: response });
  } catch (error) {
    console.error('Cancel bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function reuseBill(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, code: '7242', message: errors.array()[0].msg, errors: errors.array() });
    }

    const { paymentControlNumber, reuseReason } = req.body;

    // GePG only lets an institution reuse a control number it was issued.
    const prior = await Bill.findByControlNumber(paymentControlNumber);
    if (!prior) {
      return res.status(404).json({
        success: false,
        code: '7335',
        message: describeCode('7335'),
      });
    }

    await Bill.create({ ...req.body, generatedBy: actorName(req) }, req.body.items || []);

    const billData = await loadBillDataForSubmission(req.body.billId, actorName(req));
    billData.paymentControlNumber = String(paymentControlNumber);
    billData.reuseReason = reuseReason;

    const response = await gepgClient.reuseBillControlNumber(billData);

    const ack = await recordSubmissionAck(req.body.billId, response);
    if (!ack.ok) {
      return res.status(422).json({
        ...ackFailureBody(ack, response),
        message: `Bill created but GePG rejected the reuse request: ${ack.description || ack.code}`
      });
    }

    res.status(201).json({ success: true, message: 'Control number reuse submitted to GePG', ack, data: response });
  } catch (error) {
    console.error('Reuse bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function changeBillExpiry(req, res) {
  try {
    const { billId } = req.params;
    const { billExpiryDate, reason } = req.body;

    if (!billExpiryDate || !reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, code: '7242', message: 'billExpiryDate and reason are required' });
    }

    const newExpiry = new Date(billExpiryDate);
    if (Number.isNaN(newExpiry.getTime())) {
      return res.status(400).json({ success: false, code: '7231', message: describeCode('7231') });
    }

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ success: false, code: '7204', message: describeCode('7204') });
    }

    // paid or cancelled bills are final, use reuse for those
    if (bill.status !== 'APPROVED' || !bill.payment_control_number) {
      return res.status(400).json({
        success: false,
        code: '7333',
        message: `Only an approved bill with a control number can have its expiry changed (this bill is ${bill.status}).`
      });
    }

    // This API extends: the new date must be in the future and later than the current one.
    if (newExpiry <= new Date() || newExpiry <= new Date(bill.bill_expiry_date)) {
      return res.status(400).json({
        success: false,
        code: '7231',
        message: 'New expiry date must be in the future and later than the current expiry date'
      });
    }

    const actor = actorName(req);
    const response = await gepgClient.updateBill({
      billId,
      billExpiryDate: formatDateTime(newExpiry),
      updateReason: String(reason).trim(),
      billGeneratedBy: actor,
      billApprovedBy: actor
    });

    const ack = await recordSubmissionAck(billId, response);
    if (!ack.ok) {
      return res.status(422).json({
        ...ackFailureBody(ack, response),
        message: `GePG rejected the expiry change: ${ack.description || ack.code}`
      });
    }

    // keep the local expiry in step with GePG
    await Bill.updateExpiry(billId, billExpiryDate);

    res.json({ success: true, message: 'Bill expiry change submitted to GePG', ack, data: response });
  } catch (error) {
    console.error('Change bill expiry error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function validateBulkBill(bill) {
  const invalid = (message) => ({ code: '7242', message });

  if (!bill || typeof bill !== 'object') return invalid('Bill must be an object');
  if (!bill.billId) return invalid('Bill ID is required');
  if (!(Number(bill.billAmount) > 0)) return invalid('Bill amount must be a number greater than zero');
  if (!bill.billExpiryDate || Number.isNaN(new Date(bill.billExpiryDate).getTime())) return invalid('Invalid expiry date format');
  if (!bill.payerId) return invalid('Payer ID is required');
  if (!bill.payerName) return invalid('Payer name is required');
  if (!Array.isArray(bill.items) || bill.items.length === 0) return invalid('At least one bill item is required');
  if (bill.items.some(i => !(Number(i && i.billItemAmount) > 0))) {
    return invalid('Each bill item amount must be a number greater than zero');
  }

  const submitted = [...new Set(bill.items.map(i => i && i.gfsCode).filter(Boolean))];
  const valid = submitted.length ? await GfsCode.findActiveCodesIn(submitted) : [];
  const unknown = submitted.filter(c => !valid.includes(c));
  if (unknown.length > 0) {
    return { code: '7223', message: `Unknown or inactive GFS code(s): ${unknown.join(', ')}` };
  }

  return null;
}

const BULK_MAX_BILLS = 100;

async function bulkCreateAndSubmit(req, res) {
  const { bills } = req.body || {};

  if (!Array.isArray(bills) || bills.length === 0) {
    return res.status(400).json({ success: false, code: '7242', message: 'bills must be a non-empty array' });
  }
  if (bills.length > BULK_MAX_BILLS) {
    return res.status(400).json({ success: false, code: '7242', message: `A bulk request may contain at most ${BULK_MAX_BILLS} bills` });
  }

  const actor = actorName(req);
  const results = [];

  for (const bill of bills) {
    const billId = bill && bill.billId;

    try {
      const problem = await validateBulkBill(bill);
      if (problem) {
        results.push({ billId, success: false, code: problem.code, message: problem.message });
        continue;
      }

      await Bill.create({ ...bill, generatedBy: actor }, bill.items);

      const billData = await loadBillDataForSubmission(billId, actor);
      const response = await gepgClient.submitBill(billData);
      const ack = await recordSubmissionAck(billId, response);

      results.push(ack.ok
        ? { billId, success: true, code: ack.code, message: 'Submitted to GePG' }
        : { billId, success: false, code: ack.code, message: ack.description || 'GePG rejected the bill' });
    } catch (error) {
      console.error(`Bulk bill ${billId} error:`, error);
      // Duplicate local billId (UNIQUE) is the usual cause - report it plainly.
      const duplicate = error.code === 'ER_DUP_ENTRY';
      results.push({
        billId,
        success: false,
        code: duplicate ? '7226' : undefined,
        message: duplicate ? `${describeCode('7226')} (billId already exists)` : error.message
      });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  res.status(200).json({
    success: succeeded === results.length,
    message: `${succeeded} of ${results.length} bills submitted to GePG`,
    summary: { total: results.length, succeeded, failed: results.length - succeeded },
    results
  });
}

async function getBills(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await Bill.findAll(page, limit, {
      status: req.query.status,
      paymentControlNumber: req.query.controlNumber,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getBillById(req, res) {
  try {
    const { billId } = req.params;
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const items = await BillItem.findByBillId(billId);
    const payments = await Payment.findByBillId(billId);

    res.json({ success: true, data: { ...bill, items, payments, ...paymentSummary(bill, payments) } });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function getBillStatus(req, res) {
  try {
    const { billId } = req.params;
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const payments = await Payment.findByBillId(billId);

    res.json({
      success: true,
      data: {
        billId: bill.bill_id,
        status: bill.status,
        paymentControlNumber: bill.payment_control_number,
        transactionStatus: bill.transaction_status,
        transactionStatusCode: bill.transaction_status_code,
        ...paymentSummary(bill, payments)
      }
    });
  } catch (error) {
    console.error('Get bill status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

function paymentSummary(bill, payments) {
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.paid_amount || 0), 0);
  const billAmount = parseFloat(bill.bill_amount || 0);

  return {
    isPaid: bill.status === 'PAID',
    totalPaid,
    remainingAmount: Math.max(billAmount - totalPaid, 0)
  };
}

async function handleBillResponseWebhook(req, res) {
  const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();
  let billResp;

  try {
    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    billResp = verified.billSubRes;

    if (!billResp) {
      throw gepgError('Payload did not contain billSubRes', ACK.INVALID_DATA);
    }

    const billDtlList = xmlBuilder.toArray(billResp.BillDtls && billResp.BillDtls.BillDtl);

    for (const billDtl of billDtlList) {
      await Bill.applySubmissionResponse(billDtl.BillId, {
        paymentControlNumber: billDtl.BillCntrNum,
        transactionStatus: billResp.BillHdr.ResSts,
        transactionStatusCode: billDtl.BillStsCode
      });
    }

    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: billResp.BillHdr.ResId,
      statusCode: '7101',
      type: 'billSubResAck'
    });
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Bill response webhook error:', error);
    const ackCode = ackCodeFor(error);
    if (ackCode === ACK.INVALID_SIGNATURE || ackCode === ACK.SIGNATURE_CONFIG) {
      console.warn(`Rejected inbound GePG message (${ackCode}): ${error.message}`);
    }
    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: billResp && billResp.BillHdr ? billResp.BillHdr.ResId : '',
      statusCode: ackCode,
      type: 'billSubResAck'
    });
    res.set('Content-Type', 'application/xml');
    res.status(httpStatusFor(ackCode)).send(ackXML);
  }
}

module.exports = {
  createBill,
  submitBill,
  createAndSubmit,
  cancelBill,
  reuseBill,
  changeBillExpiry,
  bulkCreateAndSubmit,
  getBills,
  getBillById,
  getBillStatus,
  handleBillResponseWebhook
};
