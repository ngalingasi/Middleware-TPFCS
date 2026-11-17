// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Payment controller
// └──────────────────────────────────────────────────────────────────────────┘

const Payment = require('../models/Payment');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');
const { ACK, gepgError, ackCodeFor, httpStatusFor } = require('../utils/gepgErrors');

const ONLINE_CHANNELS = new Set(['MC', 'VC', 'OT', 'AMEX', 'UPI']);

// pmtSpNtfReq webhook (spec 6.2); one notification can carry several payments
async function handlePaymentNotification(req, res) {
  const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();
  let pmtReq;

  try {
    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    pmtReq = verified.pmtSpNtfReq;

    if (!pmtReq) {
      throw gepgError('Payload did not contain pmtSpNtfReq', ACK.INVALID_DATA);
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
        // v5 has no direct PSP receipt tag - TrdPtyTrxId is the closest analogue ("third party receipt
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
    const ackCode = ackCodeFor(error);
    if (ackCode === ACK.INVALID_SIGNATURE || ackCode === ACK.SIGNATURE_CONFIG) {
      console.warn(`Rejected inbound GePG message (${ackCode}): ${error.message}`);
    }
    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: pmtReq && pmtReq.PmtHdr ? pmtReq.PmtHdr.ReqId : '',
      statusCode: ackCode,
      type: 'pmtSpNtfReqAck'
    });
    res.set('Content-Type', 'application/xml');
    res.status(httpStatusFor(ackCode)).send(ackXML);
  }
}

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
