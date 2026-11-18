# GePG callbacks to the bridge

These are the messages GePG sends to the bridge, and what the bridge answers. They are the call back URLs the GePG v5 specification asks an institution to provide (section 1.3).

## 1. URLs to give GePG

| For | URL |
|---|---|
| Bill submission response | http://localhost:5001/api/bills/webhook/response |
| Payment notification | http://localhost:5001/api/payments/webhook/notification |
| Successful payments summary (reconciliation response) | http://localhost:5001/api/reconciliation/webhook/response |
| Quote request (prepaid services) | Not used: the bridge does not support the prepaid quote flow |

## 2. The request

| Item | Value |
|---|---|
| Method | POST |
| Content-Type | application/xml (text/xml also works) |
| Body | The GePG message wrapped like this: <Gepg> the message </Gepg> with a <signature> element after the message, as in the v5 specification. |

### Signing

- GePG signs the message (the XML between <Gepg> and <signature>, exactly as sent) with its private key: SHA256withRSA, then base64.
- The bridge verifies it with GePG's public certificate, which is exchanged at onboarding.
- A message with a missing or wrong signature is answered with code 7303 and is not recorded.

### How the bridge behaves

- The bridge answers straight away; it does the follow-up (telling billing systems) afterwards, so GePG is never kept waiting.
- Sending the same message again is safe: a payment already recorded (same TrxId) is acknowledged with 7101 and not recorded twice, and a repeated bill response changes nothing.
- Anything other than 7101 means GePG should send the message again later (spec section 3.4: every 30 minutes for up to 24 hours).
- The BillId in a message must be one the bridge submitted (it is the bill id with the billing system's code in front, for example ICDV-INV-1001). A payment for a bill the bridge does not know is answered with 7317.

## 3. Bill submission response

`POST /api/bills/webhook/response` (spec section 4.2.2.2, message `billSubRes`)

**When:** GePG has processed a bill the bridge submitted, and gives the control number or the reason it refused.

**What the bridge does:** The bridge stores the control number (or the rejection) on the bill and tells the billing system that owns it.

URL: `http://localhost:5001/api/bills/webhook/response`

### Sample: Bill accepted

```xml
<Gepg>
<billSubRes>
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
</billSubRes>
<signature>SignatureGoesHere</signature>
</Gepg>
```

### Sample: Bill refused (invalid GFS code)

```xml
<Gepg>
<billSubRes>
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
</billSubRes>
<signature>SignatureGoesHere</signature>
</Gepg>
```

### What the bridge answers

The answer repeats the ResId (or ReqId) of the message it replies to, and carries its own AckId. Shown for the first sample.

| Code | HTTP status | Meaning |
|---|---|---|
| `7101` | 200 | Received and recorded. GePG need not send it again. |
| `7303` | 400 | The signature is missing or does not match. Nothing was recorded. |
| `7242` | 400 | The XML could not be read, or it is not the expected message. Nothing was recorded. |
| `7304` | 400 | The bridge cannot find GePG's public certificate. This is the institution's fault, not the message's. |
| `7317` | 500 | The message was valid but the bridge failed while recording it (for example, the bill is unknown). GePG should send it again later. |

**7101** (HTTP 200):

```xml
<billSubResAck><AckId>SP0231763373731500</AckId><ResId>GW20261117100211</ResId><AckStsCode>7101</AckStsCode></billSubResAck>
```

**7303** (HTTP 400):

```xml
<billSubResAck><AckId>SP0231763373731500</AckId><ResId>GW20261117100211</ResId><AckStsCode>7303</AckStsCode></billSubResAck>
```

**7242** (HTTP 400):

```xml
<billSubResAck><AckId>SP0231763373731500</AckId><ResId>GW20261117100211</ResId><AckStsCode>7242</AckStsCode></billSubResAck>
```

**7304** (HTTP 400):

```xml
<billSubResAck><AckId>SP0231763373731500</AckId><ResId>GW20261117100211</ResId><AckStsCode>7304</AckStsCode></billSubResAck>
```

**7317** (HTTP 500):

```xml
<billSubResAck><AckId>SP0231763373731500</AckId><ResId>GW20261117100211</ResId><AckStsCode>7317</AckStsCode></billSubResAck>
```

## 4. Payment notification

`POST /api/payments/webhook/notification` (spec section 6.2, message `pmtSpNtfReq`)

**When:** A payer has paid a control number through a bank or mobile network.

**What the bridge does:** The bridge records each payment (a repeat of the same TrxId is ignored), marks the bill paid once the payments cover it, and tells the owning billing system.

URL: `http://localhost:5001/api/payments/webhook/notification`

### Sample: One payment

```xml
<Gepg>
<pmtSpNtfReq>
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
</pmtSpNtfReq>
<signature>SignatureGoesHere</signature>
</Gepg>
```

### Sample: Two payments in one message

```xml
<Gepg>
<pmtSpNtfReq>
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
</pmtSpNtfReq>
<signature>SignatureGoesHere</signature>
</Gepg>
```

### What the bridge answers

The answer repeats the ReqId (or ReqId) of the message it replies to, and carries its own AckId. Shown for the first sample.

| Code | HTTP status | Meaning |
|---|---|---|
| `7101` | 200 | Received and recorded. GePG need not send it again. |
| `7303` | 400 | The signature is missing or does not match. Nothing was recorded. |
| `7242` | 400 | The XML could not be read, or it is not the expected message. Nothing was recorded. |
| `7304` | 400 | The bridge cannot find GePG's public certificate. This is the institution's fault, not the message's. |
| `7317` | 500 | The message was valid but the bridge failed while recording it (for example, the bill is unknown). GePG should send it again later. |

**7101** (HTTP 200):

```xml
<pmtSpNtfReqAck><AckId>SP0231763373731500</AckId><ReqId>100000-2835934-85-23458343</ReqId><AckStsCode>7101</AckStsCode></pmtSpNtfReqAck>
```

**7303** (HTTP 400):

```xml
<pmtSpNtfReqAck><AckId>SP0231763373731500</AckId><ReqId>100000-2835934-85-23458343</ReqId><AckStsCode>7303</AckStsCode></pmtSpNtfReqAck>
```

**7242** (HTTP 400):

```xml
<pmtSpNtfReqAck><AckId>SP0231763373731500</AckId><ReqId>100000-2835934-85-23458343</ReqId><AckStsCode>7242</AckStsCode></pmtSpNtfReqAck>
```

**7304** (HTTP 400):

```xml
<pmtSpNtfReqAck><AckId>SP0231763373731500</AckId><ReqId>100000-2835934-85-23458343</ReqId><AckStsCode>7304</AckStsCode></pmtSpNtfReqAck>
```

**7317** (HTTP 500):

```xml
<pmtSpNtfReqAck><AckId>SP0231763373731500</AckId><ReqId>100000-2835934-85-23458343</ReqId><AckStsCode>7317</AckStsCode></pmtSpNtfReqAck>
```

## 5. Successful payments summary (reconciliation response)

`POST /api/reconciliation/webhook/response` (spec section 7.4, message `sucSpPmtRes`)

**When:** GePG answers a reconciliation request with the day's successful payments.

**What the bridge does:** The bridge saves the list and records any payment it did not already have (for example one whose notification was lost), then tells the owning billing system.

URL: `http://localhost:5001/api/reconciliation/webhook/response`

### Sample: One payment for the day

```xml
<Gepg>
<sucSpPmtRes>
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
</sucSpPmtRes>
<signature>SignatureGoesHere</signature>
</Gepg>
```

### What the bridge answers

The answer repeats the ResId (or ReqId) of the message it replies to, and carries its own AckId. Shown for the first sample.

| Code | HTTP status | Meaning |
|---|---|---|
| `7101` | 200 | Received and recorded. GePG need not send it again. |
| `7303` | 400 | The signature is missing or does not match. Nothing was recorded. |
| `7242` | 400 | The XML could not be read, or it is not the expected message. Nothing was recorded. |
| `7304` | 400 | The bridge cannot find GePG's public certificate. This is the institution's fault, not the message's. |
| `7317` | 500 | The message was valid but the bridge failed while recording it (for example, the bill is unknown). GePG should send it again later. |

**7101** (HTTP 200):

```xml
<sucSpPmtResAck><AckId>SP0231763373731500</AckId><ResId>4747a838-67b7-11eb-ae93</ResId><AckStsCode>7101</AckStsCode></sucSpPmtResAck>
```

**7303** (HTTP 400):

```xml
<sucSpPmtResAck><AckId>SP0231763373731500</AckId><ResId>4747a838-67b7-11eb-ae93</ResId><AckStsCode>7303</AckStsCode></sucSpPmtResAck>
```

**7242** (HTTP 400):

```xml
<sucSpPmtResAck><AckId>SP0231763373731500</AckId><ResId>4747a838-67b7-11eb-ae93</ResId><AckStsCode>7242</AckStsCode></sucSpPmtResAck>
```

**7304** (HTTP 400):

```xml
<sucSpPmtResAck><AckId>SP0231763373731500</AckId><ResId>4747a838-67b7-11eb-ae93</ResId><AckStsCode>7304</AckStsCode></sucSpPmtResAck>
```

**7317** (HTTP 500):

```xml
<sucSpPmtResAck><AckId>SP0231763373731500</AckId><ResId>4747a838-67b7-11eb-ae93</ResId><AckStsCode>7317</AckStsCode></sucSpPmtResAck>
```

## Testing the callbacks yourself

The samples carry the placeholder `SignatureGoesHere` instead of a real signature, so the bridge answers them with 7303. That is a useful test by itself. To see 7101 you need messages signed with a key the bridge trusts:

```bash
# 1. make a test key and certificate
openssl req -x509 -newkey rsa:2048 -nodes -keyout gepg-test-key.pem -out gepg-test-cert.pem -days 30 -subj "/CN=gepg-test"

# 2. in the bridge, open Settings > Certificates and upload gepg-test-cert.pem as
#    "GePG's public certificate" (an uploaded certificate overrides GEPG_PUBLIC_CERT_PATH in .env)

# 3. sign every sample; this also writes a Postman environment with the signatures
cd backend
node scripts/sign-gepg-sample.js ../gepg-test-key.pem
```

Import the environment it writes (`gepg-callbacks-test-environment.json`) in Postman. In Insomnia, copy the `sig_...` values into the environment. Create the bill the sample refers to first (the BillId must exist), or the bridge answers 7317. Afterwards, upload the real GePG certificate again (or press Remove to go back to the `.env` value).
