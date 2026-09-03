const { validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Payment = require('../models/Payment');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');

/**
 * POST /api/bills/create
 */
async function createBill(req, res) {
  try {
    // billRoutes.js's billValidation (including the GFS-code check) was
    // previously never enforced here - express-validator's body() rules
    // only populate req, they don't reject on their own without this.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const result = await Bill.create(req.body, req.body.items || []);
    res.status(201).json({ success: true, message: 'Bill created successfully', data: result });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Shared helper: load a bill + its items and shape them into the payload
 * gepgClient/xmlBuilder expect.
 */
async function loadBillDataForSubmission(billId) {
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
    billGeneratedBy: 'SYSTEM',
    billApprovedBy: 'SYSTEM',
    currency: bill.currency,
    billEquivAmount: bill.bill_equiv_amount,
    billPayOption: bill.bill_pay_option,
    // v5-only fields the current bill-create form doesn't collect yet -
    // sourced from the DB when present, otherwise xmlBuilder defaults apply.
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

function formatDateTime(date) {
  const d = new Date(date);
  return d.toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * POST /api/bills/submit/:billId
 *
 * Sends the bill to GePG. The response here is only GePG's immediate
 * billSubReqAck - the real approval/rejection arrives later via the
 * billSubRes webhook (see handleBillResponseWebhook below).
 */
async function submitBill(req, res) {
  const { billId } = req.params;

  try {
    const billData = await loadBillDataForSubmission(billId);
    const response = await gepgClient.submitBill(billData);

    const ack = response.billSubReqAck;
    if (ack) {
      await Bill.markSubmitted(billId, ack.AckStsCode);
    }

    res.json({ success: true, message: 'Bill submitted to GePG successfully', data: response });
  } catch (error) {
    console.error('Submit bill error:', error);
    await Bill.markSubmissionFailed(billId, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/bills/create-and-submit
 */
async function createAndSubmit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    await Bill.create(req.body, req.body.items || []);

    const billData = await loadBillDataForSubmission(req.body.billId);
    const response = await gepgClient.submitBill(billData);

    const ack = response.billSubReqAck;
    if (ack) {
      await Bill.markSubmitted(req.body.billId, ack.AckStsCode);
    }

    res.status(201).json({ success: true, message: 'Bill created and submitted successfully', data: response });
  } catch (error) {
    console.error('Create and submit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/bills/cancel/:billId
 */
async function cancelBill(req, res) {
  try {
    const { billId } = req.params;
    const { reason } = req.body;

    const bill = await Bill.findCancellable(billId);
    if (!bill) {
      return res.status(400).json({ success: false, message: 'Bill not found or cannot be cancelled' });
    }

    // Bill cancellation is synchronous in v5 - the HTTP response IS the
    // billCanclRes, there is no separate ack/webhook step.
    const response = await gepgClient.cancelBill(billId, reason);
    const canclRes = response.billCanclRes;

    if (canclRes && canclRes.CanclSts !== 'GS') {
      return res.status(502).json({
        success: false,
        message: canclRes.CanclStsDesc || 'GePG declined the cancellation',
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

/**
 * GET /api/bills
 */
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

/**
 * GET /api/bills/:billId
 *
 * Includes the bill's payment history so a calling system doesn't need a
 * second round-trip to find out how much has actually been paid.
 */
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

/**
 * GET /api/bills/:billId/status
 *
 * Lightweight endpoint for the calling system to poll "has this bill been
 * paid yet" using the billId it originally submitted, without pulling the
 * full bill + items payload every time.
 */
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

/**
 * Shared paid/unpaid summary for a bill given its recorded payments.
 *
 * isPaid mirrors the bills.status column (set to PAID by Payment.create
 * whenever any payment is recorded against the bill - see that model for
 * the caveat below). totalPaid/remainingAmount are computed independently
 * from the actual payment rows, which matters for BillPayOpt
 * PARTIAL/LIMITED bills: today Payment.create marks a bill PAID on its
 * *first* instalment regardless of amount, so bill.status alone can say
 * "PAID" while remainingAmount is still greater than zero. Callers that
 * need to know the bill is *fully* settled should check remainingAmount,
 * not just isPaid/status.
 */
function paymentSummary(bill, payments) {
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.paid_amount || 0), 0);
  const billAmount = parseFloat(bill.bill_amount || 0);

  return {
    isPaid: bill.status === 'PAID',
    totalPaid,
    remainingAmount: Math.max(billAmount - totalPaid, 0)
  };
}

/**
 * POST /api/bills/webhook/response
 *
 * Receives the asynchronous billSubRes message GePG sends once the
 * bill has actually been processed (spec section 4.1, steps III-IV).
 *
 * Every inbound GePG message is signed - we verify it before trusting
 * anything in the body, and always ack with billSubResAck so GePG stops
 * retrying.
 */
async function handleBillResponseWebhook(req, res) {
  const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();
  let billResp;

  try {
    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    billResp = verified.billSubRes;

    if (!billResp) {
      throw new Error('Payload did not contain billSubRes');
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
    const ackXML = xmlBuilder.buildAcknowledgement({
      ackId: gepgClient.generateReqId(),
      referenceId: billResp && billResp.BillHdr ? billResp.BillHdr.ResId : '',
      statusCode: '7242',
      type: 'billSubResAck'
    });
    res.set('Content-Type', 'application/xml');
    res.status(400).send(ackXML);
  }
}

module.exports = {
  createBill,
  submitBill,
  createAndSubmit,
  cancelBill,
  getBills,
  getBillById,
  getBillStatus,
  handleBillResponseWebhook
};
