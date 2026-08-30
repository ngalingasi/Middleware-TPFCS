const Payment = require('../models/Payment');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');

/**
 * POST /api/payments/webhook/notification
 * Receives gepgPmtSpInfo (offline/bank payment notification).
 */
async function handlePaymentNotification(req, res) {
  try {
    const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();

    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    const pymtTrxInf = verified.gepgPmtSpInfo.PymtTrxInf;

    const paymentData = {
      transactionId: pymtTrxInf.TrxId,
      spCode: pymtTrxInf.SpCode,
      payRefId: pymtTrxInf.PayRefId,
      billId: pymtTrxInf.BillId,
      paymentControlNumber: pymtTrxInf.PayCtrNum,
      billAmount: parseFloat(pymtTrxInf.BillAmt),
      paidAmount: parseFloat(pymtTrxInf.PaidAmt),
      billPayOption: pymtTrxInf.BillPayOpt,
      currency: pymtTrxInf.CCy,
      transactionDateTime: pymtTrxInf.TrxDtTm,
      usedPaymentChannel: pymtTrxInf.UsdPayChnl,
      payerCellNumber: pymtTrxInf.PyrCellNum,
      payerName: pymtTrxInf.PyrName,
      payerEmail: pymtTrxInf.PyrEmail,
      pspReceiptNumber: pymtTrxInf.PspReceiptNumber,
      pspName: pymtTrxInf.PspName,
      creditedAccountNumber: pymtTrxInf.CtrAccNum
    };

    await Payment.createOffline(paymentData);

    const ackXML = xmlBuilder.buildAcknowledgement('7101', 'payment');
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Payment notification error:', error);
    const ackXML = xmlBuilder.buildAcknowledgement('7102', 'payment');
    res.set('Content-Type', 'application/xml');
    res.status(400).send(ackXML);
  }
}

/**
 * POST /api/payments/webhook/online-notification
 * Receives gepgOlPmtNtfSpInfo (card/mobile online payment notification).
 */
async function handleOnlinePaymentNotification(req, res) {
  try {
    const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();

    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    const olPymtTrxInf = verified.gepgOlPmtNtfSpInfo.OlPymtTrxInf;

    const paymentData = {
      transactionId: olPymtTrxInf.TrxId,
      authorizationCode: olPymtTrxInf.Auth,
      spCode: olPymtTrxInf.SpCode,
      payRefId: olPymtTrxInf.PayRefId,
      billId: olPymtTrxInf.BillId,
      paymentControlNumber: olPymtTrxInf.PayCtrNum,
      paidAmount: parseFloat(olPymtTrxInf.PaidAmt),
      currency: olPymtTrxInf.CCy,
      transactionDateTime: olPymtTrxInf.TrxDtTm,
      usedPaymentChannel: olPymtTrxInf.UsdPayChnl,
      payerCellNumber: olPymtTrxInf.PyrCellNum,
      payerName: olPymtTrxInf.PyrName,
      payerEmail: olPymtTrxInf.PyrEmail
    };

    await Payment.createOnline(paymentData);

    const ackXML = xmlBuilder.buildAcknowledgement('7101', 'online_payment');
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Online payment notification error:', error);
    const ackXML = xmlBuilder.buildAcknowledgement('7102', 'online_payment');
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
  handleOnlinePaymentNotification,
  getPayments,
  getPaymentById,
  getPaymentStatistics
};
