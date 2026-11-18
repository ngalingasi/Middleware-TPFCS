// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG callbacks: what GePG sends to the bridge, and what the bridge answers
// └──────────────────────────────────────────────────────────────────────────┘

// For the GePG team. These are the messages GePG posts to the bridge (the
// "call back URLs" the v5 spec asks an institution to give GePG), written from
// the spec's own samples. The answers shown are produced by the bridge's real
// acknowledgement code, so they follow it if it changes.

const xmlBuilder = require('./xmlBuilder');
const { ACK, httpStatusFor } = require('./gepgErrors');
const { describeCode } = require('./gepgCodes');

const DEFAULT_BASE = 'https://bridge.example.com';
const PLACEHOLDER = 'SignatureGoesHere';
const ACK_ID = 'SP0231763373731500';

const billOk = `<billSubRes>
  <BillHdr>
    <ResId>GW20261117100211</ResId>
    <ReqId>SP0231763373731000</ReqId>
    <GrpBillId>ICDV-INV-1001</GrpBillId>
    <CustCntrNum>991330026625</CustCntrNum>
    <ResSts>GS</ResSts>
    <ResStsCode>7101</ResStsCode>
    <ResStsDesc>Successful</ResStsDesc>
  </BillHdr>
  <BillDtls>
    <BillDtl>
      <BillId>ICDV-INV-1001</BillId>
      <BillCntrNum>991330026625</BillCntrNum>
      <BillStsCode>7101</BillStsCode>
      <BillStsDesc>Successful</BillStsDesc>
    </BillDtl>
  </BillDtls>
</billSubRes>`;

const billFailed = `<billSubRes>
  <BillHdr>
    <ResId>GW20261117100212</ResId>
    <ReqId>SP0231763373731001</ReqId>
    <GrpBillId>ICDV-INV-1002</GrpBillId>
    <CustCntrNum>0</CustCntrNum>
    <ResSts>GF</ResSts>
    <ResStsCode>7102</ResStsCode>
    <ResStsDesc>Failure</ResStsDesc>
  </BillHdr>
  <BillDtls>
    <BillDtl>
      <BillId>ICDV-INV-1002</BillId>
      <BillCntrNum>0</BillCntrNum>
      <BillStsCode>7223</BillStsCode>
      <BillStsDesc>Invalid or inactive government financial statistic code (gfs) or service type</BillStsDesc>
    </BillDtl>
  </BillDtls>
</billSubRes>`;

const paymentSingle = `<pmtSpNtfReq>
  <PmtHdr>
    <ReqId>100000-2835934-85-23458343</ReqId>
    <GrpBillId>ICDV-INV-1001</GrpBillId>
    <SpGrpCode>SP023</SpGrpCode>
    <CustCntrNum>991330026625</CustCntrNum>
    <EntryCnt>1</EntryCnt>
  </PmtHdr>
  <PmtDtls>
    <PmtTrxDtl>
      <SpCode>SP023</SpCode>
      <BillId>ICDV-INV-1001</BillId>
      <BillCtrNum>991330026625</BillCtrNum>
      <PspCode>PSP900</PspCode>
      <PspName>Example Commercial Bank</PspName>
      <TrxId>100816320574</TrxId>
      <PayRefId>921033031098001</PayRefId>
      <BillAmt>500000</BillAmt>
      <PaidAmt>300000</PaidAmt>
      <BillPayOpt>2</BillPayOpt>
      <Ccy>TZS</Ccy>
      <CollAccNum>45610032210</CollAccNum>
      <TrxDtTm>2026-11-16T09:35:59</TrxDtTm>
      <UsdPayChnl>MB</UsdPayChnl>
      <TrdPtyTrxId>259-848-4898-88</TrdPtyTrxId>
      <QtRefId/>
      <PyrCellNum>255786030028</PyrCellNum>
      <PyrEmail/>
      <PyrName>Vidah Mwakyusa</PyrName>
      <Rsv1/>
      <Rsv2/>
      <Rsv3/>
    </PmtTrxDtl>
  </PmtDtls>
</pmtSpNtfReq>`;

const paymentTwo = `<pmtSpNtfReq>
  <PmtHdr>
    <ReqId>100000-2835934-85-23458344</ReqId>
    <GrpBillId>ICDV-INV-1001</GrpBillId>
    <SpGrpCode>SP023</SpGrpCode>
    <CustCntrNum>991330026625</CustCntrNum>
    <EntryCnt>2</EntryCnt>
  </PmtHdr>
  <PmtDtls>
    <PmtTrxDtl>
      <SpCode>SP023</SpCode>
      <BillId>ICDV-INV-1001</BillId>
      <BillCtrNum>991330026625</BillCtrNum>
      <PspCode>PSP900</PspCode>
      <PspName>Example Commercial Bank</PspName>
      <TrxId>100816320575</TrxId>
      <PayRefId>921033031098002</PayRefId>
      <BillAmt>500000</BillAmt>
      <PaidAmt>100000</PaidAmt>
      <BillPayOpt>2</BillPayOpt>
      <Ccy>TZS</Ccy>
      <CollAccNum>45610032210</CollAccNum>
      <TrxDtTm>2026-11-16T10:02:10</TrxDtTm>
      <UsdPayChnl>IB</UsdPayChnl>
      <TrdPtyTrxId>259-848-4898-89</TrdPtyTrxId>
      <QtRefId/>
      <PyrCellNum>255786030028</PyrCellNum>
      <PyrEmail/>
      <PyrName/>
      <Rsv1/>
      <Rsv2/>
      <Rsv3/>
    </PmtTrxDtl>
    <PmtTrxDtl>
      <SpCode>SP023</SpCode>
      <BillId>ICDV-INV-1001</BillId>
      <BillCtrNum>991330026625</BillCtrNum>
      <PspCode>PSP006</PspCode>
      <PspName>Example Mobile Money</PspName>
      <TrxId>100816320576</TrxId>
      <PayRefId>921033031098003</PayRefId>
      <BillAmt>500000</BillAmt>
      <PaidAmt>100000</PaidAmt>
      <BillPayOpt>2</BillPayOpt>
      <Ccy>TZS</Ccy>
      <CollAccNum>45610032210</CollAccNum>
      <TrxDtTm>2026-11-16T10:04:31</TrxDtTm>
      <UsdPayChnl>MPESA</UsdPayChnl>
      <TrdPtyTrxId>MP-77123</TrdPtyTrxId>
      <QtRefId/>
      <PyrCellNum>255786030028</PyrCellNum>
      <PyrEmail/>
      <PyrName/>
      <Rsv1/>
      <Rsv2/>
      <Rsv3/>
    </PmtTrxDtl>
  </PmtDtls>
</pmtSpNtfReq>`;

const reconciliation = `<sucSpPmtRes>
  <BatchHdr>
    <ResId>4747a838-67b7-11eb-ae93</ResId>
    <ReqId>SP0231763373731777</ReqId>
    <SpGrpCode>SP023</SpGrpCode>
    <SysCode>tjv47</SysCode>
    <PayStsCode>7101</PayStsCode>
    <PayStsDesc>Successful</PayStsDesc>
  </BatchHdr>
  <PmtDtls>
    <PmtTrxDtl>
      <CustCntrNum>991330026625</CustCntrNum>
      <GrpBillId>ICDV-INV-1001</GrpBillId>
      <SpCode>SP023</SpCode>
      <BillId>ICDV-INV-1001</BillId>
      <BillCtrNum>991330026625</BillCtrNum>
      <PspCode>PSP900</PspCode>
      <PspName>Example Commercial Bank</PspName>
      <TrxId>100816320574</TrxId>
      <PayRefId>921033031098001</PayRefId>
      <BillAmt>500000</BillAmt>
      <PaidAmt>300000</PaidAmt>
      <BillPayOpt>2</BillPayOpt>
      <Ccy>TZS</Ccy>
      <CollAccNum>45610032210</CollAccNum>
      <TrxDtTm>2026-11-16T09:35:59</TrxDtTm>
      <UsdPayChnl>MB</UsdPayChnl>
      <TrdPtyTrxId>259-848-4898-88</TrdPtyTrxId>
      <QtRefId/>
      <PyrCellNum>255786030028</PyrCellNum>
      <PyrEmail/>
      <PyrName>Vidah Mwakyusa</PyrName>
      <Rsv1/>
      <Rsv2/>
      <Rsv3/>
    </PmtTrxDtl>
  </PmtDtls>
</sucSpPmtRes>`;

const CALLBACKS = [
  {
    id: 'billResponse', name: 'Bill submission response', root: 'billSubRes', ackType: 'billSubResAck', ackRef: 'ResId', ackRefValue: 'GW20261117100211',
    path: '/api/bills/webhook/response', specSection: '4.2.2.2',
    when: 'GePG has processed a bill the bridge submitted, and gives the control number or the reason it refused.',
    effect: 'The bridge stores the control number (or the rejection) on the bill and tells the billing system that owns it.',
    samples: [
      { id: 'bill_ok', title: 'Bill accepted', xml: billOk },
      { id: 'bill_failed', title: 'Bill refused (invalid GFS code)', xml: billFailed }
    ]
  },
  {
    id: 'paymentNotification', name: 'Payment notification', root: 'pmtSpNtfReq', ackType: 'pmtSpNtfReqAck', ackRef: 'ReqId', ackRefValue: '100000-2835934-85-23458343',
    path: '/api/payments/webhook/notification', specSection: '6.2',
    when: 'A payer has paid a control number through a bank or mobile network.',
    effect: 'The bridge records each payment (a repeat of the same TrxId is ignored), marks the bill paid once the payments cover it, and tells the owning billing system.',
    samples: [
      { id: 'payment_single', title: 'One payment', xml: paymentSingle },
      { id: 'payment_two', title: 'Two payments in one message', xml: paymentTwo }
    ]
  },
  {
    id: 'reconciliationResponse', name: 'Successful payments summary (reconciliation response)', root: 'sucSpPmtRes', ackType: 'sucSpPmtResAck', ackRef: 'ResId', ackRefValue: '4747a838-67b7-11eb-ae93',
    path: '/api/reconciliation/webhook/response', specSection: '7.4',
    when: 'GePG answers a reconciliation request with the day\'s successful payments.',
    effect: 'The bridge saves the list and records any payment it did not already have (for example one whose notification was lost), then tells the owning billing system.',
    samples: [{ id: 'reconciliation', title: 'One payment for the day', xml: reconciliation }]
  }
];

function envelope(xml, signature = PLACEHOLDER) {
  return `<Gepg>\n${xml}\n<signature>${signature}</signature>\n</Gepg>`;
}

// the bridge's answer for a code, built by the real acknowledgement code
function ackFor(callback, statusCode) {
  const xml = xmlBuilder.buildAcknowledgement({ ackId: ACK_ID, referenceId: callback.ackRefValue, statusCode, type: callback.ackType });
  return { statusCode, httpStatus: statusCode === ACK.OK ? 200 : httpStatusFor(statusCode), xml };
}

const OUTCOMES = [
  { code: ACK.OK, meaning: 'Received and recorded. GePG need not send it again.' },
  { code: ACK.INVALID_SIGNATURE, meaning: 'The signature is missing or does not match. Nothing was recorded.' },
  { code: ACK.INVALID_DATA, meaning: 'The XML could not be read, or it is not the expected message. Nothing was recorded.' },
  { code: ACK.SIGNATURE_CONFIG, meaning: 'The bridge cannot find GePG\'s public certificate. This is the institution\'s fault, not the message\'s.' },
  { code: ACK.PROCESSING_ERROR, meaning: 'The message was valid but the bridge failed while recording it (for example, the bill is unknown). GePG should send it again later.' }
];

function buildCallbackDocs({ baseUrl = DEFAULT_BASE } = {}) {
  const callbacks = CALLBACKS.map((c) => ({
    ...c,
    url: `${baseUrl}${c.path}`,
    samples: c.samples.map((s) => ({ ...s, envelopeText: envelope(s.xml), signedText: s.xml })),
    answers: OUTCOMES.map((o) => ({ ...ackFor(c, o.code), meaning: o.meaning, codeDescription: describeCode(o.code) }))
  }));

  return {
    title: 'GePG callbacks to the bridge',
    baseUrl,
    placeholder: PLACEHOLDER,
    callbacks,
    urlsToRegister: [
      ...callbacks.map((c) => ({ for: c.name, url: c.url })),
      { for: 'Quote request (prepaid services)', url: 'Not used: the bridge does not support the prepaid quote flow' }
    ],
    request: {
      method: 'POST',
      contentType: 'application/xml (text/xml also works)',
      body: 'The GePG message wrapped like this: <Gepg> the message </Gepg> with a <signature> element after the message, as in the v5 specification.'
    },
    signing: [
      'GePG signs the message (the XML between <Gepg> and <signature>, exactly as sent) with its private key: SHA256withRSA, then base64.',
      'The bridge verifies it with GePG\'s public certificate, which is exchanged at onboarding.',
      'A message with a missing or wrong signature is answered with code 7303 and is not recorded.'
    ],
    behaviour: [
      'The bridge answers straight away; it does the follow-up (telling billing systems) afterwards, so GePG is never kept waiting.',
      'Sending the same message again is safe: a payment already recorded (same TrxId) is acknowledged with 7101 and not recorded twice, and a repeated bill response changes nothing.',
      'Anything other than 7101 means GePG should send the message again later (spec section 3.4: every 30 minutes for up to 24 hours).',
      'The BillId in a message must be one the bridge submitted (it is the bill id with the billing system\'s code in front, for example ICDV-INV-1001). A payment for a bill the bridge does not know is answered with 7317.'
    ]
  };
}

module.exports = { buildCallbackDocs, CALLBACKS, envelope, PLACEHOLDER };
