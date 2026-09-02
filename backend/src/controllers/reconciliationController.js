const ReconciliationRequest = require('../models/ReconciliationRequest');
const ReconciliationTransaction = require('../models/ReconciliationTransaction');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');

/**
 * POST /api/reconciliation/request
 *
 * Submits a sucSpPmtReq to GePG (spec section 7.2). v5 dropped the v4
 * success/exception-report choice (ReconcOpt) - only successful-payments
 * reconciliation exists now, so it is no longer sent to GePG.
 */
async function submitReconciliationRequest(req, res) {
  try {
    const { transactionDate } = req.body;

    if (!transactionDate) {
      return res.status(400).json({ success: false, message: 'transactionDate is required (YYYY-MM-DD)' });
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
      throw new Error('Payload did not contain sucSpPmtRes');
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
    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: reconcResp && reconcResp.BatchHdr ? reconcResp.BatchHdr.ResId : '',
      statusCode: '7242',
      type: 'sucSpPmtResAck'
    });
    res.set('Content-Type', 'application/xml');
    res.status(400).send(ackXML);
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
