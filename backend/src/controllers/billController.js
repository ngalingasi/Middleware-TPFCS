const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const gepgClient = require('../services/gepgClient');
const xmlBuilder = require('../utils/xmlBuilder');

/**
 * POST /api/bills/create
 */
async function createBill(req, res) {
  try {
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
    reminderFlag: bill.reminder_flag,
    billPayOption: bill.bill_pay_option,
    returnResponseFlag: 'true',
    items: items.map(item => ({
      billItemRef: item.bill_item_ref,
      useItemRefOnPay: item.use_item_ref_on_pay,
      billItemAmount: item.bill_item_amount,
      billItemEquivAmount: item.bill_item_equiv_amount,
      billItemMiscAmount: item.bill_item_misc_amount,
      gfsCode: item.gfs_code
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
 * gepgBillSubReqAck - the real approval/rejection arrives later via the
 * gepgBillSubResp webhook (see handleBillResponseWebhook below).
 */
async function submitBill(req, res) {
  const { billId } = req.params;

  try {
    const billData = await loadBillDataForSubmission(billId);
    const response = await gepgClient.submitBill(billData);

    const ack = response.gepgBillSubReqAck;
    if (ack) {
      await Bill.markSubmitted(billId, ack.TrxStsCode);
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
    await Bill.create(req.body, req.body.items || []);

    const billData = await loadBillDataForSubmission(req.body.billId);
    const response = await gepgClient.submitBill(billData);

    const ack = response.gepgBillSubReqAck;
    if (ack) {
      await Bill.markSubmitted(req.body.billId, ack.TrxStsCode);
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

    const response = await gepgClient.cancelBill(billId, reason);
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
 */
async function getBillById(req, res) {
  try {
    const { billId } = req.params;
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const items = await BillItem.findByBillId(billId);
    res.json({ success: true, data: { ...bill, items } });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/bills/webhook/response
 *
 * Receives the asynchronous gepgBillSubResp message GePG sends once the
 * bill has actually been processed (spec section 3, steps III-IV). This
 * endpoint was previously missing entirely - bills would sit "PENDING"
 * forever since nothing ever recorded the GS/GF outcome or control number.
 *
 * Every inbound GePG message is signed - we verify it before trusting
 * anything in the body, and always ack with gepgBillSubRespAck so GePG
 * stops retrying.
 */
async function handleBillResponseWebhook(req, res) {
  try {
    const envelopeXML = typeof req.body === 'string' ? req.body : req.body.toString();

    const verified = await gepgClient.verifyIncomingMessage(envelopeXML);
    const billResp = verified.gepgBillSubResp;

    if (!billResp) {
      throw new Error('Payload did not contain gepgBillSubResp');
    }

    const trxInfList = xmlBuilder.toArray(billResp.BillTrxInf);

    for (const trxInf of trxInfList) {
      await Bill.applySubmissionResponse(trxInf.BillId, {
        paymentControlNumber: trxInf.PayCntrNum,
        transactionStatus: trxInf.TrxSts,
        transactionStatusCode: trxInf.TrxStsCode
      });
    }

    const ackXML = xmlBuilder.buildAcknowledgement('7101', 'bill');
    res.set('Content-Type', 'application/xml');
    res.send(ackXML);
  } catch (error) {
    console.error('Bill response webhook error:', error);
    const ackXML = xmlBuilder.buildAcknowledgement('7102', 'bill');
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
  handleBillResponseWebhook
};
