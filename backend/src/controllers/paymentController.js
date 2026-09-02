const Payment = require('../models/Payment');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');

// v5 has no online/offline distinction at the protocol level (both were
// merged into pmtSpNtfReq) - this is a local approximation only, so the
// dashboard's existing online/offline split keeps working.
const ONLINE_CHANNELS = new Set(['MC', 'VC', 'OT', 'AMEX', 'UPI']);

/**
 * POST /api/payments/webhook/notification
 * Receives pmtSpNtfReq (spec section 6.2). A single notification may carry
 * multiple payment entries (PmtHdr.EntryCnt), one PmtTrxDtl each.
 */
async function handlePaymentNotification(req, res) {
  const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();
  let pmtReq;

  try {
    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    pmtReq = verified.pmtSpNtfReq;

    if (!pmtReq) {
      throw new Error('Payload did not contain pmtSpNtfReq');
    }

    const trxDtlList = xmlBuilder.toArray(pmtReq.PmtDtls && pmtReq.PmtDtls.PmtTrxDtl);

    for (const trxDtl of trxDtlList) {
      const usedPaymentChannel = trxDtl.UsdPayChnl;

      const paymentData = {
        transactionId: trxDtl.TrxId,
        spCode: trxDtl.SpCode,
        payRefId: trxDtl.PayRefId,
        billId: trxDtl.BillId,
        paymentControlNumber: trxDtl.BillCtrNum,
        billAmount: parseFloat(trxDtl.BillAmt),
        paidAmount: parseFloat(trxDtl.PaidAmt),
        billPayOption: trxDtl.BillPayOpt,
        currency: trxDtl.Ccy,
        transactionDateTime: trxDtl.TrxDtTm,
        usedPaymentChannel,
        payerCellNumber: trxDtl.PyrCellNum,
        payerName: trxDtl.PyrName,
        payerEmail: trxDtl.PyrEmail,
        // v5 has no direct PSP receipt tag - TrdPtyTrxId is the closest
        // analogue ("third party receipt ... Issuing Bank authorization,
        // MNO Receipt, Aggregator Receipt etc.").
        pspReceiptNumber: trxDtl.TrdPtyTrxId,
        pspName: trxDtl.PspName,
        pspCode: trxDtl.PspCode,
        creditedAccountNumber: trxDtl.CollAccNum,
        paymentType: ONLINE_CHANNELS.has((usedPaymentChannel || '').toUpperCase()) ? 'ONLINE' : 'OFFLINE'
      };

      await Payment.create(paymentData);
    }

    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: pmtReq.PmtHdr.ReqId,
      statusCode: '7101',
      type: 'pmtSpNtfReqAck'
    });
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Payment notification error:', error);
    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: pmtReq && pmtReq.PmtHdr ? pmtReq.PmtHdr.ReqId : '',
      statusCode: '7242',
      type: 'pmtSpNtfReqAck'
    });
    res.set('Content-Type', 'application/xml');
    res.status(400).send(ackXML);
  }
}

/**
 * GET /api/payments
 */
async function getPayments(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await Payment.findAll(page, limit, {
      status: req.query.status,
      paymentType: req.query.paymentType,
      billId: req.query.billId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/payments/:paymentId
 */
async function getPaymentById(req, res) {
  try {
    const payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/payments/statistics/summary
 */
async function getPaymentStatistics(req, res) {
  try {
    const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];

    const stats = await Payment.getStatistics(startDate, endDate);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  handlePaymentNotification,
  getPayments,
  getPaymentById,
  getPaymentStatistics
};
