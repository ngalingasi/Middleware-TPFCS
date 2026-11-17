// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ XML builder utility
// └──────────────────────────────────────────────────────────────────────────┘

const xml2js = require('xml2js');
const { ACK, gepgError } = require('./gepgErrors');

// Normal bills only (BillTyp 1). RtrRespFlg and RemFlag are left out to match the spec samples;
// confirm with GePG before go-live
class XMLBuilder {
  constructor() {
    this.builder = new xml2js.Builder({
      headless: true,
      renderOpts: { pretty: false }
    });
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  _buildBillDtl(billData) {
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

  async parseXML(xmlString) {
    try {
      return await this.parser.parseStringPromise(xmlString);
    } catch (error) {
      throw gepgError(`XML parsing failed: ${error.message}`, ACK.INVALID_DATA, error);
    }
  }

  toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }
}

module.exports = new XMLBuilder();
