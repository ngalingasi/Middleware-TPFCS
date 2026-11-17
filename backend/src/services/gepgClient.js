// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG client
// └──────────────────────────────────────────────────────────────────────────┘

const axios = require('axios');
const xmlBuilder = require('../utils/xmlBuilder');
const digitalSignature = require('../utils/digitalSignature');
const { ACK, gepgError } = require('../utils/gepgErrors');
require('dotenv').config();

class GePGClient {
  constructor() {
    this.baseURL = `http://${process.env.GEPG_IP}:${process.env.GEPG_PORT}`;
    this.spCode = process.env.GEPG_SP_CODE;
    this.subSpCode = process.env.GEPG_SUB_SP_CODE;
    this.sysCode = process.env.GEPG_SYS_CODE || process.env.GEPG_SP_SYS_ID;
    // For the Normal Bill Control Number flow SpGrpCode == SpCode.
    this.spGrpCode = process.env.GEPG_SP_GRP_CODE || this.spCode;
    this.alg = process.env.GEPG_ALG;
    this.certPath = process.env.CERT_PATH;
    this.certPassword = process.env.CERT_PASSWORD;
    this.gepgPublicCertPath = process.env.GEPG_PUBLIC_CERT_PATH;

    this.endpoints = {
      billSubmission: process.env.GEPG_ENDPOINT_BILL_SUBMISSION || '/api/bill/sigqrequest',
      billReuse: process.env.GEPG_ENDPOINT_BILL_REUSE || '/api/bill/sigqrequest_reuse',
      billUpdate: process.env.GEPG_ENDPOINT_BILL_UPDATE || '/api/bill/sigqrequest_change',
      billCancellation: process.env.GEPG_ENDPOINT_BILL_CANCELLATION || '/api/bill/sigcancel_request',
      reconciliation: process.env.GEPG_ENDPOINT_RECONCILIATION || '/api/reconciliations/sig_sp_qrequest'
    };
  }

  // Generate a fresh Service Provider request identification number
  generateReqId() {
    return `${this.spCode}${Date.now()}`;
  }

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

  async cancelBill(billId, cancellationReason, actor) {
    try {
      const data = {
        spCode: this.spCode,
        sysCode: this.sysCode,
        spGrpCode: this.spGrpCode,
        reqId: this.generateReqId(),
        billId,
        cancellationReason,
        // String(30) in the spec; xmlBuilder falls back to 'SYSTEM'
        cancelledBy: actor ? String(actor).slice(0, 30) : undefined,
        approvedBy: actor ? String(actor).slice(0, 30) : undefined
      };

      const xmlMessage = xmlBuilder.buildBillCancellationRequest(data);
      const response = await this.sendRequest(this.endpoints.billCancellation, xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill cancellation failed: ${error.message}`);
    }
  }

  async submitReconciliationRequest(transactionDate) {
    return this.submitReconciliationRequestWithId(this.generateReqId(), transactionDate);
  }

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

  async verifyIncomingMessage(envelopeXML) {
    try {
      const result = digitalSignature.extractAndVerifyEnvelope(
        envelopeXML,
        this.gepgPublicCertPath
      );

      if (!result.isValid) {
        throw gepgError('Invalid signature from GePG', ACK.INVALID_SIGNATURE);
      }

      return await xmlBuilder.parseXML(result.message);

    } catch (error) {
      // keep the specific code (7303, 7304, 7242) for the webhook ack
      throw gepgError(`Message verification failed: ${error.message}`, error.gepgCode || ACK.INVALID_SIGNATURE, error);
    }
  }
}

module.exports = new GePGClient();
