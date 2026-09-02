const axios = require('axios');
const xmlBuilder = require('../utils/xmlBuilder');
const digitalSignature = require('../utils/digitalSignature');
require('dotenv').config();

class GePGClient {
  constructor() {
    this.baseURL = `http://${process.env.GEPG_IP}:${process.env.GEPG_PORT}`;
    this.spCode = process.env.GEPG_SP_CODE;
    this.subSpCode = process.env.GEPG_SUB_SP_CODE;
    // v5 header/body field is SysCode - GEPG_SP_SYS_ID is kept as the env
    // var name for continuity with the existing .env, its value now feeds
    // SysCode instead of v4's SpSysId.
    this.sysCode = process.env.GEPG_SYS_CODE || process.env.GEPG_SP_SYS_ID;
    // For the Normal Bill Control Number flow SpGrpCode == SpCode.
    this.spGrpCode = process.env.GEPG_SP_GRP_CODE || this.spCode;
    this.alg = process.env.GEPG_ALG;
    this.certPath = process.env.CERT_PATH;
    this.certPassword = process.env.CERT_PASSWORD;
    this.gepgPublicCertPath = process.env.GEPG_PUBLIC_CERT_PATH;

    // Endpoint paths are "communicated during integration" per the v5 spec
    // (not published as fixed paths like v4 was) - kept as env-overridable,
    // falling back to the previously-known v4 paths as placeholders until
    // GePG confirms the v5 equivalents.
    this.endpoints = {
      billSubmission: process.env.GEPG_ENDPOINT_BILL_SUBMISSION || '/api/bill/sigqrequest',
      billReuse: process.env.GEPG_ENDPOINT_BILL_REUSE || '/api/bill/sigqrequest_reuse',
      billUpdate: process.env.GEPG_ENDPOINT_BILL_UPDATE || '/api/bill/sigqrequest_change',
      billCancellation: process.env.GEPG_ENDPOINT_BILL_CANCELLATION || '/api/bill/sigcancel_request',
      reconciliation: process.env.GEPG_ENDPOINT_RECONCILIATION || '/api/reconciliations/sig_sp_qrequest'
    };
  }

  /**
   * Generate a fresh Service Provider request identification number.
   * Every v5 request needs a unique ReqId (spec sample: "SP20210205130219").
   */
  generateReqId() {
    return `${this.spCode}${Date.now()}`;
  }

  /**
   * Send request to GePG
   */
  async sendRequest(endpoint, xmlMessage, useSigning = true) {
    try {
      let requestBody = xmlMessage;

      // Sign message if required
      if (useSigning) {
        requestBody = digitalSignature.createSignedEnvelope(
          xmlMessage,
          this.certPath,
          this.certPassword
        );
      }

      const headers = {
        'Content-Type': 'application/xml',
        'Gepg-Com': process.env.GEPG_COM,
        'Gepg-Code': this.spCode,
        'Gepg-Alg': this.alg
      };

      const response = await axios.post(
        `${this.baseURL}${endpoint}`,
        requestBody,
        { headers }
      );

      return response.data;

    } catch (error) {
      if (error.response) {
        throw new Error(`GePG API Error: ${error.response.status} - ${error.response.data}`);
      } else if (error.request) {
        throw new Error('No response from GePG server');
      } else {
        throw new Error(`Request failed: ${error.message}`);
      }
    }
  }

  /**
   * Submit bill to GePG.
   *
   * NOTE on the flow (spec section 4.1): the HTTP response to this call is
   * only the immediate billSubReqAck ("GePG received the bill"). The real
   * outcome (GS/GF + bill control number) arrives later as an asynchronous
   * billSubRes callback to our own webhook endpoint - see
   * billController.handleBillResponseWebhook. Callers should not expect a
   * final status from this method's return value.
   */
  async submitBill(billData) {
    try {
      billData.spCode = this.spCode;
      billData.subSpCode = this.subSpCode;
      billData.sysCode = this.sysCode;
      billData.spGrpCode = this.spGrpCode;
      billData.reqId = billData.reqId || this.generateReqId();

      const xmlMessage = xmlBuilder.buildBillSubmissionRequest(billData);
      const response = await this.sendRequest(this.endpoints.billSubmission, xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill submission failed: ${error.message}`);
    }
  }

  /**
   * Reuse bill control number
   */
  async reuseBillControlNumber(billData) {
    try {
      billData.spCode = this.spCode;
      billData.subSpCode = this.subSpCode;
      billData.sysCode = this.sysCode;
      billData.spGrpCode = this.spGrpCode;
      billData.reqId = billData.reqId || this.generateReqId();

      const xmlMessage = xmlBuilder.buildBillSubmissionRequest(billData);
      const response = await this.sendRequest(this.endpoints.billReuse, xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill control number reuse failed: ${error.message}`);
    }
  }

  /**
   * Update bill information (expiry extension)
   */
  async updateBill(billData) {
    try {
      billData.spCode = this.spCode;
      billData.sysCode = this.sysCode;
      billData.spGrpCode = this.spGrpCode;
      billData.reqId = billData.reqId || this.generateReqId();

      const xmlMessage = xmlBuilder.buildBillChangeRequest(billData);
      const response = await this.sendRequest(this.endpoints.billUpdate, xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill update failed: ${error.message}`);
    }
  }

  /**
   * Cancel bill (Normal Bill Control Number - single bill per request).
   * Synchronous API: the HTTP response to this call is the billCanclRes
   * itself, no separate ack/webhook involved.
   */
  async cancelBill(billId, cancellationReason) {
    try {
      const data = {
        spCode: this.spCode,
        sysCode: this.sysCode,
        spGrpCode: this.spGrpCode,
        reqId: this.generateReqId(),
        billId,
        cancellationReason
      };

      const xmlMessage = xmlBuilder.buildBillCancellationRequest(data);
      const response = await this.sendRequest(this.endpoints.billCancellation, xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill cancellation failed: ${error.message}`);
    }
  }

  /**
   * Submit reconciliation request
   */
  async submitReconciliationRequest(transactionDate) {
    return this.submitReconciliationRequestWithId(this.generateReqId(), transactionDate);
  }

  /**
   * Same as submitReconciliationRequest, but lets the caller pass a
   * pre-generated ReqId so it can be persisted before the GePG call is
   * made (avoids a race where GePG acks a request we can't match to any
   * local record).
   */
  async submitReconciliationRequestWithId(reqId, transactionDate) {
    try {
      const data = {
        reqId,
        spCode: this.spCode,
        sysCode: this.sysCode,
        spGrpCode: this.spGrpCode,
        transactionDate // Format: YYYY-MM-DD
      };

      const xmlMessage = xmlBuilder.buildReconciliationRequest(data);
      const response = await this.sendRequest(this.endpoints.reconciliation, xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Reconciliation request failed: ${error.message}`);
    }
  }

  /**
   * Verify incoming message from GePG
   */
  async verifyIncomingMessage(envelopeXML) {
    try {
      const result = digitalSignature.extractAndVerifyEnvelope(
        envelopeXML,
        this.gepgPublicCertPath
      );

      if (!result.isValid) {
        throw new Error('Invalid signature from GePG');
      }

      return await xmlBuilder.parseXML(result.message);

    } catch (error) {
      throw new Error(`Message verification failed: ${error.message}`);
    }
  }
}

module.exports = new GePGClient();
