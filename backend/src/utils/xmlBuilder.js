const xml2js = require('xml2js');

class XMLBuilder {
  constructor() {
    this.builder = new xml2js.Builder({
      headless: true,
      renderOpts: { pretty: false }
    });
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  /**
   * Build GePG Bill Submission Request XML
   */
  buildBillSubmissionRequest(billData) {
    const billItems = billData.items.map(item => ({
      BillItem: {
        BillItemRef: item.billItemRef,
        UseItemRefOnPay: item.useItemRefOnPay || 'N',
        BillItemAmt: item.billItemAmount,
        BillItemEqvAmt: item.billItemEquivAmount,
        BillItemMiscAmt: item.billItemMiscAmount || 0,
        GfsCode: item.gfsCode
      }
    }));

    const xmlObject = {
      gepgBillSubReq: {
        BillHdr: {
          SpCode: billData.spCode,
          RtrRespFlg: billData.returnResponseFlag || 'true'
        },
        BillTrxInf: {
          BillId: billData.billId,
          SubSpCode: billData.subSpCode,
          SpSysId: billData.spSysId,
          BillAmt: billData.billAmount,
          MiscAmt: billData.miscAmount || 0,
          BillExprDt: billData.billExpiryDate,
          PyrId: billData.payerId,
          PyrName: billData.payerName,
          BillDesc: billData.billDescription,
          BillGenDt: billData.billGeneratedDate,
          BillGenBy: billData.billGeneratedBy,
          BillApprBy: billData.billApprovedBy,
          PyrCellNum: billData.payerCellNumber,
          PyrEmail: billData.payerEmail,
          Ccy: billData.currency || 'TZS',
          BillEqvAmt: billData.billEquivAmount,
          RemFlag: billData.reminderFlag || 'true',
          BillPayOpt: billData.billPayOption || '1',
          BillItems: billItems
        }
      }
    };

    // Add control number for reuse if provided
    if (billData.paymentControlNumber) {
      xmlObject.gepgBillSubReq.BillTrxInf.PayCntrNum = billData.paymentControlNumber;
    }

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Bill Cancellation Request XML
   */
  buildBillCancellationRequest(data) {
    const xmlObject = {
      gepgBillCanclReq: {
        SpCode: data.spCode,
        SpSysId: data.spSysId,
        CanclReasn: data.cancellationReason,
        BillId: Array.isArray(data.billIds) ? data.billIds : [data.billIds]
      }
    };

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Bill Change/Update Request XML
   */
  buildBillChangeRequest(data) {
    const xmlObject = {
      gepgBillSubReq: {
        BillHdr: {
          SpCode: data.spCode,
          RtrRespFlg: 'true'
        },
        BillTrxInf: {
          BillId: data.billId,
          SpSysId: data.spSysId,
          BillExprDt: data.billExpiryDate
        }
      }
    };

    // Add reserved fields if provided
    if (data.billRsv1) xmlObject.gepgBillSubReq.BillTrxInf.BillRsv1 = data.billRsv1;
    if (data.billRsv2) xmlObject.gepgBillSubReq.BillTrxInf.BillRsv2 = data.billRsv2;
    if (data.billRsv3) xmlObject.gepgBillSubReq.BillTrxInf.BillRsv3 = data.billRsv3;

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Reconciliation Request XML
   */
  buildReconciliationRequest(data) {
    const xmlObject = {
      gepgSpReconcReq: {
        SpReconcReqId: data.reconciliationRequestId,
        SpCode: data.spCode,
        SpSysId: data.spSysId,
        TnxDt: data.transactionDate,
        ReconcOpt: data.reconciliationOption
      }
    };

    return this.builder.buildObject(xmlObject);
  }

  /**
   * Build Acknowledgement XML
   */
  buildAcknowledgement(statusCode, type = 'bill') {
    let xmlObject;

    switch (type) {
      case 'bill':
        xmlObject = {
          gepgBillSubRespAck: {
            TrxStsCode: statusCode
          }
        };
        break;
      case 'payment':
        xmlObject = {
          gepgPmtSpInfoAck: {
            TrxStsCode: statusCode
          }
        };
        break;
      case 'online_payment':
        xmlObject = {
          gepgOlPmtNtfSpAck: {
            OlStsCode: statusCode
          }
        };
        break;
      case 'reconciliation':
        xmlObject = {
          gepgSpReconcRespAck: {
            ReconcStsCode: statusCode
          }
        };
        break;
      default:
        xmlObject = {
          Ack: {
            StsCode: statusCode
          }
        };
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
   * Extract message from Gepg envelope
   */
  async extractMessageFromEnvelope(envelopeXML) {
    try {
      const parsed = await this.parseXML(envelopeXML);
      
      // The actual message is the first child (excluding signature)
      const messageKey = Object.keys(parsed.Gepg).find(key => key !== 'gepgSignature');
      const signature = parsed.Gepg.gepgSignature;
      
      return {
        message: parsed.Gepg[messageKey],
        signature: signature,
        messageType: messageKey
      };
    } catch (error) {
      throw new Error(`Failed to extract message: ${error.message}`);
    }
  }

  /**
   * xml2js (with explicitArray:false) returns a single object when a
   * repeatable tag appears once, and an array when it appears multiple
   * times. Repeatable tags like BillId, ReconcTrxInf, BillCanclTrxDt need
   * consistent array handling regardless of count.
   */
  toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }
}

module.exports = new XMLBuilder();
