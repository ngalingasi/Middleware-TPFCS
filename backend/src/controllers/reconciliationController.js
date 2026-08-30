const ReconciliationRequest = require('../models/ReconciliationRequest');
const ReconciliationTransaction = require('../models/ReconciliationTransaction');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');

/**
 * POST /api/reconciliation/request
 *
 * Submits a gepgSpReconcReq to GePG (spec section 6). This endpoint did
 * not exist before - gepgClient.submitReconciliationRequest was written
 * but never wired to a route, so reconciliation could never actually be
 * requested from this system.
 */
async function submitReconciliationRequest(req, res) {
  try {
    const { transactionDate, reconciliationOption = 1 } = req.body;

    if (!transactionDate) {
      return res.status(400).json({ success: false, message: 'transactionDate is required (YYYY-MM-DD)' });
    }

    const reconciliationRequestId = Date.now().toString();

    await ReconciliationRequest.create({
      reconciliationRequestId,
      spCode: gepgClient.spCode,
      spSysId: gepgClient.spSysId,
      transactionDate,
      reconciliationOption
    });

    const response = await gepgClient.submitReconciliationRequestWithId(
      reconciliationRequestId,
      transactionDate,
      reconciliationOption
    );

    const ack = response.gepgSpReconcReqAck;
    if (ack) {
      await ReconciliationRequest.markAcknowledged(reconciliationRequestId, ack.ReconcStsCode);
    }

    res.status(201).json({
      success: true,
      message: 'Reconciliation request submitted to GePG',
      data: { reconciliationRequestId, ...response }
    });
  } catch (error) {
    console.error('Submit reconciliation request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/reconciliation/webhook/response
 *
 * Receives the asynchronous gepgSpReconcResp GePG sends after processing
 * a reconciliation request (spec section 6, steps III-IV). This webhook
 * did not exist before - the reconciliation_transactions table was
 * defined in the schema but nothing ever wrote to it.
 */
async function handleReconciliationResponseWebhook(req, res) {
  try {
    const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();

    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    const reconcResp = verified.gepgSpReconcResp;

    if (!reconcResp) {
      throw new Error('Payload did not contain gepgSpReconcResp');
    }

    const batchInfo = reconcResp.ReconcBatchInfo;
    const reconciliationRequestId = batchInfo.SpReconcReqId;

    const rawTransactions = xmlBuilder.toArray(reconcResp.ReconcTrans && reconcResp.ReconcTrans.ReconcTrxInf);
    const transactions = rawTransactions.map(t => ({
      spBillId: t.SpBillId,
      billControlNumber: t.BillCtrNum,
      pspTransactionId: t.pspTrxId,
      paidAmount: t.PaidAmt,
      currency: t.CCy,
      payRefId: t.PayRefId,
      transactionDateTime: t.TrxDtTm,
      creditedAccountNumber: t.CtrAccNum,
      usedPaymentChannel: t.UsdPayChnl,
      pspName: t.PspName,
      pspCode: t.PspCode,
      depositorCellNum: t.DptCellNum,
      depositorName: t.DptName,
      depositorEmail: t.DptEmailAddr,
      remarks: t.Remarks
    }));

    await ReconciliationTransaction.createMany(reconciliationRequestId, transactions);
    await ReconciliationRequest.markCompleted(reconciliationRequestId, batchInfo.ReconcStsCode);

    const ackXML = xmlBuilder.buildAcknowledgement('7101', 'reconciliation');
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Reconciliation response webhook error:', error);
    const ackXML = xmlBuilder.buildAcknowledgement('7102', 'reconciliation');
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
