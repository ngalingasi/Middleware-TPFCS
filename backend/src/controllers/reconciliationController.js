const ReconciliationRequest = require('../models/ReconciliationRequest');
const ReconciliationTransaction = require('../models/ReconciliationTransaction');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');
const { ACK, gepgError, ackCodeFor, httpStatusFor } = require('../utils/gepgErrors');
const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const { validationResult } = require('express-validator');

// Same local ONLINE/OFFLINE approximation paymentController uses.
const ONLINE_CHANNELS = new Set(['MC', 'VC', 'OT', 'AMEX', 'UPI']);

// GePG keeps reconciliation data for 7 days from receipt (spec section 7,
// note 4) and only reconciles *previous* days: today and future dates are
// out of range (SIT RP001_02: 10 days old / today / beyond today must fail
// with an out-of-range error). Tanzania is UTC+3 with no DST, so "today" is
// computed there rather than in the server's timezone.
const RECONCILIATION_MAX_DAYS_BACK = 7;

function tanzaniaToday() {
  const tzNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tzNow.getUTCFullYear(), tzNow.getUTCMonth(), tzNow.getUTCDate()));
}

/**
 * Returns null when the date is acceptable, otherwise { code, message }
 * using GePG's own codes (7318 invalid date, 7319 out of allowable range).
 */
function validateReconciliationDate(transactionDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    return { code: '7318', message: 'Invalid reconciliation request date (expected YYYY-MM-DD)' };
  }

  const requested = new Date(`${transactionDate}T00:00:00Z`);
  if (Number.isNaN(requested.getTime()) || requested.toISOString().slice(0, 10) !== transactionDate) {
    return { code: '7318', message: 'Invalid reconciliation request date' };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const daysBack = Math.round((tanzaniaToday() - requested) / dayMs);

  if (daysBack < 1 || daysBack > RECONCILIATION_MAX_DAYS_BACK) {
    return {
      code: '7319',
      message: `Reconciliation request date is out of allowable range (must be between ${RECONCILIATION_MAX_DAYS_BACK} days ago and yesterday)`
    };
  }

  return null;
}

/**
 * POST /api/reconciliation/request
 *
 * Submits a sucSpPmtReq to GePG (spec section 7.2). v5 dropped the v4
 * success/exception-report choice (ReconcOpt) - only successful-payments
 * reconciliation exists now, so it is no longer sent to GePG.
 */
async function submitReconciliationRequest(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, code: '7318', message: errors.array()[0].msg, errors: errors.array() });
    }

    const { transactionDate } = req.body;

    if (!transactionDate) {
      return res.status(400).json({ success: false, code: '7318', message: 'transactionDate is required (YYYY-MM-DD)' });
    }

    const dateProblem = validateReconciliationDate(transactionDate);
    if (dateProblem) {
      return res.status(400).json({ success: false, code: dateProblem.code, message: dateProblem.message });
    }

    const reqId = gepgClient.generateReqId();

    await ReconciliationRequest.create({
      reconciliationRequestId: reqId,
      spCode: gepgClient.spCode,
      spSysId: gepgClient.sysCode,
      transactionDate
    });

    const response = await gepgClient.submitReconciliationRequestWithId(reqId, transactionDate);

    const ack = response.sucSpPmtReqAck;
    if (ack) {
      await ReconciliationRequest.markAcknowledged(reqId, ack.AckStsCode);
    }

    res.status(201).json({
      success: true,
      message: 'Reconciliation request submitted to GePG',
      data: { reconciliationRequestId: reqId, ...response }
    });
  } catch (error) {
    console.error('Submit reconciliation request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/reconciliation/webhook/response
 *
 * Receives the asynchronous sucSpPmtRes GePG sends after processing a
 * reconciliation request (spec section 7.1, steps III-IV).
 */
async function handleReconciliationResponseWebhook(req, res) {
  const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();
  let reconcResp;

  try {
    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    reconcResp = verified.sucSpPmtRes;

    if (!reconcResp) {
      throw gepgError('Payload did not contain sucSpPmtRes', ACK.INVALID_DATA);
    }

    const batchHdr = reconcResp.BatchHdr;
    const reconciliationRequestId = batchHdr.ReqId;

    const rawTransactions = xmlBuilder.toArray(reconcResp.PmtDtls && reconcResp.PmtDtls.PmtTrxDtl);
    const transactions = rawTransactions.map(t => ({
      spBillId: t.BillId,
      billControlNumber: t.BillCtrNum,
      pspTransactionId: t.TrxId,
      paidAmount: t.PaidAmt,
      billAmount: t.BillAmt,
      billPayOption: t.BillPayOpt,
      currency: t.Ccy,
      payRefId: t.PayRefId,
      transactionDateTime: t.TrxDtTm,
      creditedAccountNumber: t.CollAccNum,
      usedPaymentChannel: t.UsdPayChnl,
      pspName: t.PspName,
      pspCode: t.PspCode,
      // v5 renamed the v4 "depositor" (Dpt*) fields to "payer" (Pyr*) -
      // same semantic, kept in the existing depositor_* columns.
      depositorCellNum: t.PyrCellNum,
      depositorName: t.PyrName,
      depositorEmail: t.PyrEmail,
      remarks: t.Remarks
    }));

    await ReconciliationTransaction.createMany(reconciliationRequestId, transactions);

    // SIT RP001_03: a payment GePG settled but whose pmtSpNtfReq never
    // reached us must be recovered from reconciliation, otherwise the bill
    // stays unpaid here. Payment.create is idempotent on transaction id, so
    // entries we already hold are skipped.
    if (String(batchHdr.PayStsCode) === '7101') {
      for (const t of rawTransactions) {
        const bill = await Bill.findById(t.BillId);
        if (!bill) {
          console.warn(`Reconciliation: no local bill ${t.BillId} for transaction ${t.TrxId}, skipped`);
          continue;
        }

        const result = await Payment.create({
          transactionId: t.TrxId,
          spCode: t.SpCode,
          payRefId: t.PayRefId,
          billId: t.BillId,
          paymentControlNumber: t.BillCtrNum,
          billAmount: parseFloat(t.BillAmt),
          paidAmount: parseFloat(t.PaidAmt),
          billPayOption: t.BillPayOpt,
          currency: t.Ccy,
          transactionDateTime: t.TrxDtTm,
          usedPaymentChannel: t.UsdPayChnl,
          payerCellNumber: t.PyrCellNum,
          payerName: t.PyrName,
          payerEmail: t.PyrEmail,
          pspReceiptNumber: t.TrdPtyTrxId,
          pspName: t.PspName,
          pspCode: t.PspCode,
          creditedAccountNumber: t.CollAccNum,
          paymentType: ONLINE_CHANNELS.has((t.UsdPayChnl || '').toUpperCase()) ? 'ONLINE' : 'OFFLINE'
        });

        if (!result.duplicate) {
          console.log(`Reconciliation: recovered missed payment ${t.TrxId} for bill ${t.BillId}`);
        }
      }
    }
    await ReconciliationRequest.markCompleted(reconciliationRequestId, batchHdr.PayStsCode);

    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: batchHdr.ResId,
      statusCode: '7101',
      type: 'sucSpPmtResAck'
    });
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Reconciliation response webhook error:', error);
    const ackCode = ackCodeFor(error);
    if (ackCode === ACK.INVALID_SIGNATURE || ackCode === ACK.SIGNATURE_CONFIG) {
      console.warn(`Rejected inbound GePG message (${ackCode}): ${error.message}`);
    }
    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: reconcResp && reconcResp.BatchHdr ? reconcResp.BatchHdr.ResId : '',
      statusCode: ackCode,
      type: 'sucSpPmtResAck'
    });
    res.set('Content-Type', 'application/xml');
    res.status(httpStatusFor(ackCode)).send(ackXML);
  }
}

/**
 * GET /api/reconciliation
 */
async function getReconciliationRequests(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await ReconciliationRequest.findAll(page, limit, {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get reconciliation requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/reconciliation/:requestId
 */
async function getReconciliationRequestById(req, res) {
  try {
    const { requestId } = req.params;
    const request = await ReconciliationRequest.findByRequestId(requestId);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Reconciliation request not found' });
    }

    const transactions = await ReconciliationTransaction.findByRequestId(requestId);
    res.json({ success: true, data: { ...request, transactions } });
  } catch (error) {
    console.error('Get reconciliation request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  submitReconciliationRequest,
  handleReconciliationResponseWebhook,
  getReconciliationRequests,
  getReconciliationRequestById
};
