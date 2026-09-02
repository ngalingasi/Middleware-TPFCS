const xml2js = require('xml2js');

/**
 * Builds/parses GePG API v5.0 XML payloads.
 *
 * Scope: Normal Bill Control Number flow only (BillTyp=1, GrpBillId ==
 * BillId) - Combined/customer control numbers (BillTyp=2, spanning several
 * institutions) are not implemented, there being no current use case for
 * them.
 *
 * NOTE on RtrRespFlg/RemFlag: the v5 spec's field table (section 4.6)
 * still lists both as "Mandatory", but neither appears in any of the
 * document's four full bill submission/reuse/change sample payloads -
 * likely a stale carry-over from v4's documentation that wasn't fully
 * pruned. Omitted here to match the samples; verify with GePG's
 * integration team before going live in case the table is right and the
 * samples are merely incomplete.
 */
class XMLBuilder {
  constructor() {
    this.builder = new xml2js.Builder({
      headless: true,
      renderOpts: { pretty: false }
    });
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  /**
   * Build a v5 BillDtl block shared by submission and reuse requests.
   */
  _buildBillDtl(billData) {
    // xml2js repeats the parent key itself for each array element, so an
    // array of {BillItem:{...}} objects here would render as
    // <BillItems>...</BillItems><BillItems>...</BillItems> (one wrapper per
    // item) instead of one <BillItems> wrapping multiple <BillItem>
    // children - the array must live at the BillItem key, one level down.
    const billItems = billData.items.map(item => ({
      RefBillId: item.refBillId || billData.billId,
      SubSpCode: item.subSpCode || billData.subSpCode,
      GfsCode: item.gfsCode,
      BillItemRef: item.billItemRef,
      UseItemRefOnPay: item.useItemRefOnPay || 'N',
      BillItemAmt: item.billItemAmount,
      BillItemEqvAmt: item.billItemEquivAmount,
      BillItemMiscAmt: item.billItemMiscAmount || 0,
      CollSp: item.collSp || billData.spCode
    }));

    const billDtl = {
      BillId: billData.billId,
      SpCode: billData.spCode,
      CollCentCode: billData.collCentCode || '',
      BillDesc: billData.billDescription,
      CustTin: billData.custTin || '',
      CustId: billData.payerId,
      CustIdTyp: billData.custIdTyp || '1',
      CustAccnt: billData.custAccnt || '',
      CustName: billData.payerName,
      CustCellNum: billData.payerCellNumber,
      CustEmail: billData.payerEmail,
      BillGenDt: billData.billGeneratedDate,
      BillExprDt: billData.billExpiryDate,
      BillGenBy: billData.billGeneratedBy,
      BillApprBy: billData.billApprovedBy,
      BillAmt: billData.billAmount,
      BillEqvAmt: billData.billEquivAmount,
      MinPayAmt: billData.minPayAmt != null ? billData.minPayAmt : 0.01,
      Ccy: billData.currency || 'TZS',
      ExchRate: billData.exchRate || '1.00',
      BillPayOpt: billData.billPayOption || '1',
      PayPlan: billData.payPlan || '1',
      PayLimTyp: billData.payLimTyp || '1',
      PayLimAmt: billData.payLimAmt != null ? billData.payLimAmt : 0,
      CollPsp: billData.collPsp || ''
    };

    // Reuse request carries the previously issued control number + a reason
    if (billData.paymentControlNumber) {
      billDtl.BillCntrNum = billData.paymentControlNumber;
      billDtl.ReuseReasn = billData.reuseReason || 'Bill resubmission';
    }

    billDtl.BillItems = { BillItem: billItems };

    return billDtl;
  }

  /**
   * Build GePG Bill Submission Request XML (Normal Bill Control Number).
   * Also used for control number reuse when billData.paymentControlNumber
   * is present.
   */
  buildBillSubmissionRequest(billData) {
    const xmlObject = {
      billSubReq: {
        BillHdr: {
          ReqId: billData.reqId,
          SpGrpCode: billData.spGrpCode || billData.spCode,
          SysCode: billData.sysCode,
          BillTyp: '1',
          PayTyp: billData.payType || '1',
          GrpBillId: billData.billId
        },
        BillDtls: {
          BillDtl: this._buildBillDtl(billData)
        }
      }
    };

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Bill Change/Update (expiry extension) Request XML.
   */
  buildBillChangeRequest(data) {
    const billDtl = {
      BillId: data.billId,
      SpCode: data.spCode,
      BillExprDt: data.billExpiryDate,
      BillGenBy: data.billGeneratedBy || 'SYSTEM',
      BillApprBy: data.billApprovedBy || 'SYSTEM',
      UpdateReasn: data.updateReason || 'Bill expiry extension'
    };

    const xmlObject = {
      billSubReq: {
        BillHdr: {
          ReqId: data.reqId,
          SpGrpCode: data.spGrpCode || data.spCode,
          SysCode: data.sysCode,
          BillTyp: '1',
          PayTyp: data.payType || '1',
          GrpBillId: data.billId
        },
        BillDtls: {
          BillDtl: billDtl
        }
      }
    };

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Bill Cancellation Request XML. Synchronous API - the HTTP
   * response to this call is the billCanclRes itself, no separate ack.
   */
  buildBillCancellationRequest(data) {
    const xmlObject = {
      billCanclReq: {
        ReqId: data.reqId,
        SpGrpCode: data.spGrpCode || data.spCode,
        SysCode: data.sysCode,
        BillTyp: '1',
        GrpBillId: data.billId,
        CanclGenBy: data.cancelledBy || 'SYSTEM',
        CanclApprBy: data.approvedBy || 'SYSTEM',
        CanclReasn: data.cancellationReason
      }
    };

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Reconciliation Request XML. v5 dropped the success/exception
   * report choice (v4's ReconcOpt) - only successful-payments
   * reconciliation exists now.
   */
  buildReconciliationRequest(data) {
    const xmlObject = {
      sucSpPmtReq: {
        ReqId: data.reqId,
        SpGrpCode: data.spGrpCode || data.spCode,
        SysCode: data.sysCode,
        TrxDt: data.transactionDate,
        Rsv1: '',
        Rsv2: '',
        Rsv3: ''
      }
    };

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Acknowledgement XML for the three webhook messages this bridge
   * must acknowledge: billSubRes, pmtSpNtfReq, sucSpPmtRes.
   */
  buildAcknowledgement({ ackId, referenceId, statusCode, type }) {
    let xmlObject;

    switch (type) {
      case 'billSubResAck':
        xmlObject = {
          billSubResAck: {
            AckId: ackId,
            ResId: referenceId,
            AckStsCode: statusCode
          }
        };
        break;
      case 'pmtSpNtfReqAck':
        xmlObject = {
          pmtSpNtfReqAck: {
            AckId: ackId,
            ReqId: referenceId,
            AckStsCode: statusCode
          }
        };
        break;
      case 'sucSpPmtResAck':
        xmlObject = {
          sucSpPmtResAck: {
            AckId: ackId,
            ResId: referenceId,
            AckStsCode: statusCode
          }
        };
        break;
      default:
        throw new Error(`Unknown acknowledgement type: ${type}`);
    }

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Parse XML string to JavaScript object
   */
  async parseXML(xmlString) {
    try {
      return await this.parser.parseStringPromise(xmlString);
    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  /**
   * xml2js (with explicitArray:false) returns a single object when a
   * repeatable tag appears once, and an array when it appears multiple
   * times. Repeatable tags like BillDtl, PmtTrxDtl need consistent array
   * handling regardless of count.
   */
  toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }
}

module.exports = new XMLBuilder();
