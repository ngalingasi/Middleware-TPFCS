const axios = require('axios');
const xmlBuilder = require('../utils/xmlBuilder');
const digitalSignature = require('../utils/digitalSignature');
require('dotenv').config();

class GePGClient {
  constructor() {
    this.baseURL = `http://${process.env.GEPG_IP}:${process.env.GEPG_PORT}`;
    this.spCode = process.env.GEPG_SP_CODE;
    this.subSpCode = process.env.GEPG_SUB_SP_CODE;
    this.spSysId = process.env.GEPG_SP_SYS_ID;
    this.certPath = process.env.CERT_PATH;
    this.certPassword = process.env.CERT_PASSWORD;
    this.gepgPublicCertPath = process.env.GEPG_PUBLIC_CERT_PATH;
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
        'Gepg-Code': this.spCode
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
   * NOTE on the flow (spec section 3): the HTTP response to this call is
   * only the immediate gepgBillSubReqAck ("GePG received the bill"). The
   * real outcome (GS/GF + payment control number) arrives later as an
   * asynchronous gepgBillSubResp callback to our own webhook endpoint -
   * see billController.handleBillResponseWebhook. Callers should not
   * expect a final status from this method's return value.
   */
  async submitBill(billData) {
    try {
      billData.spCode = this.spCode;
      billData.subSpCode = this.subSpCode;
      billData.spSysId = this.spSysId;

      const xmlMessage = xmlBuilder.buildBillSubmissionRequest(billData);
      const response = await this.sendRequest('/api/bill/sigqrequest', xmlMessage);

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
      billData.spSysId = this.spSysId;

      const xmlMessage = xmlBuilder.buildBillSubmissionRequest(billData);
      const response = await this.sendRequest('/api/bill/sigqrequest_reuse', xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill control number reuse failed: ${error.message}`);
    }
  }

  /**
   * Update bill information
   */
  async updateBill(billData) {
    try {
      billData.spCode = this.spCode;
      billData.spSysId = this.spSysId;

      const xmlMessage = xmlBuilder.buildBillChangeRequest(billData);
      const response = await this.sendRequest('/api/bill/sigqrequest_change', xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill update failed: ${error.message}`);
    }
  }

  /**
   * Cancel bill
   */
  async cancelBill(billIds, cancellationReason) {
    try {
      const data = {
        spCode: this.spCode,
        spSysId: this.spSysId,
        billIds: Array.isArray(billIds) ? billIds : [billIds],
        cancellationReason
      };

      const xmlMessage = xmlBuilder.buildBillCancellationRequest(data);
      const response = await this.sendRequest('/api/bill/sigcancel_request', xmlMessage);

      return await xmlBuilder.parseXML(response);

    } catch (error) {
      throw new Error(`Bill cancellation failed: ${error.message}`);
    }
  }

  /**
   * Submit reconciliation request
   */
  async submitReconciliationRequest(transactionDate, reconciliationOption = 1) {
    return this.submitReconciliationRequestWithId(Date.now().toString(), transactionDate, reconciliationOption);
  }

  /**
   * Same as submitReconciliationRequest, but lets the caller pass a
   * pre-generated SpReconcReqId so it can be persisted before the GePG
   * call is made (avoids a race where GePG acks a request we can't match
   * to any local record).
   */
  async submitReconciliationRequestWithId(reconciliationRequestId, transactionDate, reconciliationOption = 1) {
    try {
      const data = {
        reconciliationRequestId,
        spCode: this.spCode,
        spSysId: this.spSysId,
        transactionDate, // Format: YYYY-MM-DD
        reconciliationOption // 1: Successful transactions, 2: Exception report
      };

      const xmlMessage = xmlBuilder.buildReconciliationRequest(data);
      const response = await this.sendRequest('/api/reconciliations/sig_sp_qrequest', xmlMessage);

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
