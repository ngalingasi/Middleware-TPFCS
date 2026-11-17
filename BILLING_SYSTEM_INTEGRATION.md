# GePG Bridge: billing system API

The bridge sits between your billing system and GePG. You send bills to the bridge; the bridge sends them to GePG, and tells you when GePG answers and when a payment arrives.

```
billing system --bill--------> bridge --signed bill--> GePG
billing system <--events------ bridge <--payment------- GePG
billing system --"is it paid?"--> bridge
```

Base URL: `http://localhost:5001`

## 1. Getting started

1. **An admin adds your system.** On the Billing Systems page: your code (for example ICDV), an optional callback URL, and a retry window.
2. **Copy the signing secret.** It is shown once. Your system uses it to check that deliveries really come from the bridge.
3. **Get an API key.** Created under Keys for your system, shown once. A key belongs to one system and only ever sees that system's bills and payments.
4. **Check the connection.** Call GET http://localhost:5001/api/v1/ping with your key. It answers with your system code.
5. **Send a bill, then listen.** POST a bill. GePG gives the control number a moment later, as a bill.approved event at your callback URL or in the events feed.

## 2. Authentication

Send your API key in the X-Api-Key header on every call. Keys are issued per billing system.

- A key only sees its own system's bills and payments. Asking for anything else answers 404, as if it did not exist.
- Bill ids are yours: you send INV-1001; GePG sees ICDV-INV-1001. Responses give both (billId and gepgBillId).
- A disabled billing system's key answers 403 until an admin enables it again.
- Reconciliation with GePG is done by the bridge, not by billing systems. Recovered payments reach you as normal payment.received events.

## 3. Endpoints

### Connection check

Confirm your key and system code work.

#### Check the connection

`GET /api/v1/ping`

Returns the billing system your API key belongs to. Use it as the first call when setting up.

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/ping' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: Key is valid

```json
{
  "success": true,
  "data": {
    "system": "ICDV",
    "name": "ICDV Management",
    "serverTime": "2026-11-16T09:30:00.000Z"
  }
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

### Bills

Create bills, check them, and change them.

#### Create a bill and send it to GePG

`POST /api/v1/bills`

Saves the bill and sends it to GePG. GePG answers in two steps: an immediate acknowledgement (this response) and, a moment later, the control number as a bill.approved event.

> A 201 means GePG received the bill, not that it approved it. Wait for the bill.approved or bill.rejected event, or check the status.

Request body (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `billId` | string | yes | Your own reference for the bill, unique within your system (at most 87 characters). GePG knows it as "ICDV-<billId>". |
| `billAmount` | number | yes | Total to pay. Must be greater than zero and equal to the total of the item amounts. |
| `billEquivAmount` | number | yes | The total in TZS. Same as billAmount for TZS bills. |
| `billExpiryDate` | string (ISO 8601) | yes | After this the bill can no longer be paid. |
| `payerId` | string | yes | Your identifier for the payer. |
| `payerName` | string | yes | Name of the payer. |
| `payerCellNumber` | string | no | Payer phone, 12 digits with the country code. |
| `payerEmail` | string | no | Payer email address. |
| `billDescription` | string | no | What the bill is for. Printed on the bill. |
| `currency` | string | no | Currency code. Defaults to TZS. |
| `billPayOption` | integer | no | How the bill may be paid: 1 full, 2 partial (instalments), 3 exact amount only, 4 any amount, 5 limited. Defaults to 1. |
| `items` | array | yes | At least one item. |
| `items[].billItemRef` | string | yes | Your reference for the item. |
| `items[].billItemAmount` | number | yes | Item amount, greater than zero. |
| `items[].billItemEquivAmount` | number | yes | Item amount in TZS. |
| `items[].gfsCode` | string | yes | The revenue code (GFS code). It must be on the bridge's active GFS list. |
| `custTin, custIdTyp, custAccnt, collCentCode, minPayAmt, exchRate, payPlan, payLimTyp, payLimAmt, collPsp` | various | no | Other GePG v5 bill fields, passed through when you need them (custIdTyp: 1 national ID, 2 driver's licence, 3 tax ID, 4 wallet number). |

Example:

```json
{
  "billId": "INV-1001",
  "billAmount": 500000,
  "billEquivAmount": 500000,
  "billExpiryDate": "2027-12-17T12:00:00",
  "payerId": "P1001",
  "payerName": "Vidah Mwakyusa",
  "payerCellNumber": "255786030028",
  "payerEmail": "vidah@example.com",
  "billDescription": "Sale of tender document",
  "currency": "TZS",
  "billPayOption": 2,
  "items": [
    {
      "billItemRef": "TND-77",
      "billItemAmount": 500000,
      "billItemEquivAmount": 500000,
      "gfsCode": "140368"
    }
  ]
}
```

Request with curl:

```bash
curl -X POST 'http://localhost:5001/api/v1/bills' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
  "billId": "INV-1001",
  "billAmount": 500000,
  "billEquivAmount": 500000,
  "billExpiryDate": "2027-12-17T12:00:00",
  "payerId": "P1001",
  "payerName": "Vidah Mwakyusa",
  "payerCellNumber": "255786030028",
  "payerEmail": "vidah@example.com",
  "billDescription": "Sale of tender document",
  "currency": "TZS",
  "billPayOption": 2,
  "items": [
    {
      "billItemRef": "TND-77",
      "billItemAmount": 500000,
      "billItemEquivAmount": 500000,
      "gfsCode": "140368"
    }
  ]
}'
```

Response 201: Created and received by GePG

```json
{
  "success": true,
  "message": "Bill created and submitted successfully",
  "ack": {
    "ok": true,
    "code": "7101",
    "description": "Successful",
    "codes": [
      {
        "code": "7101",
        "description": "Successful"
      }
    ]
  },
  "data": {
    "billSubReqAck": {
      "AckId": "GW1763373731000",
      "ReqId": "SP0231763373731000",
      "AckStsCode": "7101",
      "AckStsDesc": "Successful"
    }
  },
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001"
  }
}
```

Response 400: A value is not valid

```json
{
  "success": false,
  "code": "7242",
  "message": "Bill amount must be a number greater than zero",
  "errors": [
    {
      "type": "field",
      "value": 0,
      "msg": "Bill amount must be a number greater than zero",
      "path": "billAmount",
      "location": "body"
    }
  ]
}
```

Response 409: You already used this billId

```json
{
  "success": false,
  "code": "7226",
  "message": "A bill with this billId already exists"
}
```

Response 422: GePG refused the bill

```json
{
  "success": false,
  "code": "7242",
  "codes": [
    {
      "code": "7242",
      "description": "Invalid request data"
    }
  ],
  "message": "GePG rejected the bill: Invalid request data",
  "data": {
    "billSubReqAck": {
      "AckStsCode": "7242",
      "AckStsDesc": "Invalid request data"
    }
  }
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Create many bills at once

`POST /api/v1/bills/bulk`

Up to 100 bills. Each is checked and sent on its own, so one bad bill does not stop the others. The response lists the result of every bill.

Request body (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `bills` | array | yes | Between 1 and 100 bills. |

Example:

```json
{
  "bills": [
    {
      "billId": "INV-1001",
      "billAmount": 500000,
      "billEquivAmount": 500000,
      "billExpiryDate": "2027-12-17T12:00:00",
      "payerId": "P1001",
      "payerName": "Vidah Mwakyusa",
      "payerCellNumber": "255786030028",
      "payerEmail": "vidah@example.com",
      "billDescription": "Sale of tender document",
      "currency": "TZS",
      "billPayOption": 2,
      "items": [
        {
          "billItemRef": "TND-77",
          "billItemAmount": 500000,
          "billItemEquivAmount": 500000,
          "gfsCode": "140368"
        }
      ]
    },
    {
      "billId": "INV-1002",
      "billAmount": 500000,
      "billEquivAmount": 500000,
      "billExpiryDate": "2027-12-17T12:00:00",
      "payerId": "P1001",
      "payerName": "Amani Juma",
      "payerCellNumber": "255786030028",
      "payerEmail": "vidah@example.com",
      "billDescription": "Sale of tender document",
      "currency": "TZS",
      "billPayOption": 2,
      "items": [
        {
          "billItemRef": "TND-77",
          "billItemAmount": 500000,
          "billItemEquivAmount": 500000,
          "gfsCode": "140368"
        }
      ]
    }
  ]
}
```

Request with curl:

```bash
curl -X POST 'http://localhost:5001/api/v1/bills/bulk' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
  "bills": [
    {
      "billId": "INV-1001",
      "billAmount": 500000,
      "billEquivAmount": 500000,
      "billExpiryDate": "2027-12-17T12:00:00",
      "payerId": "P1001",
      "payerName": "Vidah Mwakyusa",
      "payerCellNumber": "255786030028",
      "payerEmail": "vidah@example.com",
      "billDescription": "Sale of tender document",
      "currency": "TZS",
      "billPayOption": 2,
      "items": [
        {
          "billItemRef": "TND-77",
          "billItemAmount": 500000,
          "billItemEquivAmount": 500000,
          "gfsCode": "140368"
        }
      ]
    },
    {
      "billId": "INV-1002",
      "billAmount": 500000,
      "billEquivAmount": 500000,
      "billExpiryDate": "2027-12-17T12:00:00",
      "payerId": "P1001",
      "payerName": "Amani Juma",
      "payerCellNumber": "255786030028",
      "payerEmail": "vidah@example.com",
      "billDescription": "Sale of tender document",
      "currency": "TZS",
      "billPayOption": 2,
      "items": [
        {
          "billItemRef": "TND-77",
          "billItemAmount": 500000,
          "billItemEquivAmount": 500000,
          "gfsCode": "140368"
        }
      ]
    }
  ]
}'
```

Response 200: Processed (check each result)

```json
{
  "success": true,
  "message": "2 of 2 bills submitted to GePG",
  "summary": {
    "total": 2,
    "succeeded": 2,
    "failed": 0
  },
  "results": [
    {
      "billId": "INV-1001",
      "success": true,
      "code": "7101",
      "message": "Submitted to GePG"
    },
    {
      "billId": "INV-1002",
      "success": true,
      "code": "7101",
      "message": "Submitted to GePG"
    }
  ]
}
```

Response 400: Empty list or more than 100

```json
{
  "success": false,
  "code": "7242",
  "message": "bills must be a non-empty array"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Reuse a control number

`POST /api/v1/bills/reuse`

Issue a new bill under a control number you were given earlier, for example after the first bill was paid or expired. Same body as creating a bill, plus the old control number and a reason.

Request body (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `paymentControlNumber` | string | yes | The control number to reuse. It must have been issued to your system. |
| `reuseReason` | string | yes | Why it is being reused. |

Example:

```json
{
  "billId": "INV-1003",
  "billAmount": 500000,
  "billEquivAmount": 500000,
  "billExpiryDate": "2027-12-17T12:00:00",
  "payerId": "P1001",
  "payerName": "Vidah Mwakyusa",
  "payerCellNumber": "255786030028",
  "payerEmail": "vidah@example.com",
  "billDescription": "Sale of tender document",
  "currency": "TZS",
  "billPayOption": 2,
  "items": [
    {
      "billItemRef": "TND-77",
      "billItemAmount": 500000,
      "billItemEquivAmount": 500000,
      "gfsCode": "140368"
    }
  ],
  "paymentControlNumber": "991330026625",
  "reuseReason": "Billed amount adjustment"
}
```

Request with curl:

```bash
curl -X POST 'http://localhost:5001/api/v1/bills/reuse' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
  "billId": "INV-1003",
  "billAmount": 500000,
  "billEquivAmount": 500000,
  "billExpiryDate": "2027-12-17T12:00:00",
  "payerId": "P1001",
  "payerName": "Vidah Mwakyusa",
  "payerCellNumber": "255786030028",
  "payerEmail": "vidah@example.com",
  "billDescription": "Sale of tender document",
  "currency": "TZS",
  "billPayOption": 2,
  "items": [
    {
      "billItemRef": "TND-77",
      "billItemAmount": 500000,
      "billItemEquivAmount": 500000,
      "gfsCode": "140368"
    }
  ],
  "paymentControlNumber": "991330026625",
  "reuseReason": "Billed amount adjustment"
}'
```

Response 201: Created and received by GePG

```json
{
  "success": true,
  "message": "Control number reuse submitted to GePG",
  "ack": {
    "ok": true,
    "code": "7101",
    "description": "Successful",
    "codes": [
      {
        "code": "7101",
        "description": "Successful"
      }
    ]
  },
  "data": {
    "billSubReqAck": {
      "AckId": "GW1763373731000",
      "ReqId": "SP0231763373731000",
      "AckStsCode": "7101",
      "AckStsDesc": "Successful"
    }
  },
  "bill": {
    "billId": "INV-1003",
    "gepgBillId": "ICDV-INV-1003"
  }
}
```

Response 404: That control number was not issued to your system

```json
{
  "success": false,
  "code": "7335",
  "message": "Requested bill control number does not exist"
}
```

Response 400: A value is not valid

```json
{
  "success": false,
  "code": "7242",
  "message": "Bill amount must be a number greater than zero",
  "errors": [
    {
      "type": "field",
      "value": 0,
      "msg": "Bill amount must be a number greater than zero",
      "path": "billAmount",
      "location": "body"
    }
  ]
}
```

Response 422: GePG refused the reuse request

```json
{
  "success": false,
  "code": "7242",
  "codes": [
    {
      "code": "7242",
      "description": "Invalid request data"
    }
  ],
  "message": "GePG rejected the reuse request: Invalid request data",
  "data": {
    "billSubReqAck": {
      "AckStsCode": "7242",
      "AckStsDesc": "Invalid request data"
    }
  }
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Check many bills at once

`POST /api/v1/bills/status`

Status, control number and amount paid for up to 100 bills in one call. References that are not yours or do not exist are listed in notFound.

Request body (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `billIds` | array of string | yes | Between 1 and 100 of your own references. |

Example:

```json
{
  "billIds": [
    "INV-1001",
    "INV-1002"
  ]
}
```

Request with curl:

```bash
curl -X POST 'http://localhost:5001/api/v1/bills/status' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
  "billIds": [
    "INV-1001",
    "INV-1002"
  ]
}'
```

Response 200: Found and not found

```json
{
  "success": true,
  "data": {
    "bills": [
      {
        "billId": "INV-1001",
        "gepgBillId": "ICDV-INV-1001",
        "status": "APPROVED",
        "controlNumber": "991330026625",
        "billAmount": 500000,
        "currency": "TZS",
        "totalPaid": 300000,
        "remaining": 200000,
        "isPaid": false,
        "expiresAt": "2027-12-17T09:00:00.000Z"
      }
    ],
    "notFound": [
      "INV-1002"
    ]
  }
}
```

Response 400: Empty list or more than 100

```json
{
  "success": false,
  "code": "7242",
  "message": "billIds must be a list of 1 to 100 bill references"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### List your bills

`GET /api/v1/bills`

Newest first, 20 per page by default. Only your own bills are returned. Amounts in bill rows are strings with two decimals.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `page` | query | no | Page number, starting at 1. | `1` |
| `limit` | query | no | Bills per page. | `20` |
| `status` | query | no | PENDING, APPROVED, REJECTED, PAID, CANCELLED or EXPIRED. | `APPROVED` |
| `controlNumber` | query | no | Only the bill with this control number. | `991330026625` |
| `startDate` | query | no | Created on or after (YYYY-MM-DD). Use with endDate. | `2026-11-01` |
| `endDate` | query | no | Created on or before (YYYY-MM-DD). | `2026-11-30` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/bills?page=1&limit=20' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: A page of bills (trimmed)

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bill_id": "ICDV-INV-1001",
      "external_ref": "INV-1001",
      "billing_system_code": "ICDV",
      "payer_id": "P1001",
      "payer_name": "Vidah Mwakyusa",
      "payer_cell_num": "255786030028",
      "bill_description": "Sale of tender document",
      "bill_amount": "500000.00",
      "currency": "TZS",
      "bill_pay_option": 2,
      "bill_expiry_date": "2027-12-17T09:00:00.000Z",
      "payment_control_number": "991330026625",
      "status": "APPROVED",
      "transaction_status": "GS",
      "transaction_status_code": "7101",
      "created_at": "2026-11-16T09:30:00.000Z",
      "item_count": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Get one bill

`GET /api/v1/bills/{billId}`

The bill with its items and payments, and how much is paid and still due.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `billId` | path | yes | Your own reference for the bill (the billId you sent when creating it). | `INV-1001` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/bills/INV-1001' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: The bill (trimmed)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "bill_id": "ICDV-INV-1001",
    "external_ref": "INV-1001",
    "billing_system_code": "ICDV",
    "payer_id": "P1001",
    "payer_name": "Vidah Mwakyusa",
    "payer_cell_num": "255786030028",
    "bill_description": "Sale of tender document",
    "bill_amount": "500000.00",
    "currency": "TZS",
    "bill_pay_option": 2,
    "bill_expiry_date": "2027-12-17T09:00:00.000Z",
    "payment_control_number": "991330026625",
    "status": "APPROVED",
    "transaction_status": "GS",
    "transaction_status_code": "7101",
    "created_at": "2026-11-16T09:30:00.000Z",
    "items": [
      {
        "id": 1,
        "bill_id": "ICDV-INV-1001",
        "bill_item_ref": "TND-77",
        "gfs_code": "140368",
        "bill_item_amount": "500000.00",
        "bill_item_equiv_amount": "500000.00"
      }
    ],
    "payments": [
      {
        "id": 12,
        "transaction_id": "T1001",
        "pay_ref_id": "99015046706",
        "bill_id": "ICDV-INV-1001",
        "payment_control_number": "991330026625",
        "bill_amount": "500000.00",
        "paid_amount": "300000.00",
        "currency": "TZS",
        "transaction_datetime": "2026-11-16T09:35:00.000Z",
        "used_payment_channel": "MB",
        "psp_name": "Example Bank",
        "payment_type": "OFFLINE",
        "status": "PENDING"
      }
    ],
    "isPaid": false,
    "totalPaid": 300000,
    "remainingAmount": 200000
  }
}
```

Response 404: No such bill among your bills

```json
{
  "success": false,
  "code": "7204",
  "message": "Bill not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Is this bill paid?

`GET /api/v1/bills/{billId}/status`

A light check you can poll. isPaid is true only when payments cover the whole amount; remainingAmount says how much is still due.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `billId` | path | yes | Your own reference for the bill (the billId you sent when creating it). | `INV-1001` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/bills/INV-1001/status' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: Status

```json
{
  "success": true,
  "data": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "status": "APPROVED",
    "paymentControlNumber": "991330026625",
    "transactionStatus": "GS",
    "transactionStatusCode": "7101",
    "isPaid": false,
    "totalPaid": 300000,
    "remainingAmount": 200000
  }
}
```

Response 404: No such bill among your bills

```json
{
  "success": false,
  "code": "7204",
  "message": "Bill not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Extend the expiry date

`POST /api/v1/bills/{billId}/extend`

Gives an approved bill more time. The control number stays the same. The new date must be in the future and later than the current one.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `billId` | path | yes | Your own reference for the bill (the billId you sent when creating it). | `INV-1001` |

Request body (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `billExpiryDate` | string (ISO 8601) | yes | The new expiry date. |
| `reason` | string | yes | Why it is being extended. |

Example:

```json
{
  "billExpiryDate": "2028-01-31T12:00:00",
  "reason": "Customer asked for more time"
}
```

Request with curl:

```bash
curl -X POST 'http://localhost:5001/api/v1/bills/INV-1001/extend' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
  "billExpiryDate": "2028-01-31T12:00:00",
  "reason": "Customer asked for more time"
}'
```

Response 200: Change received by GePG

```json
{
  "success": true,
  "message": "Bill expiry change submitted to GePG",
  "ack": {
    "ok": true,
    "code": "7101",
    "description": "Successful",
    "codes": [
      {
        "code": "7101",
        "description": "Successful"
      }
    ]
  },
  "data": {
    "billSubReqAck": {
      "AckId": "GW1763373731000",
      "ReqId": "SP0231763373731000",
      "AckStsCode": "7101",
      "AckStsDesc": "Successful"
    }
  }
}
```

Response 400: Not an approved bill, or the date is not later

```json
{
  "success": false,
  "code": "7231",
  "message": "New expiry date must be in the future and later than the current expiry date"
}
```

Response 422: GePG refused the expiry change

```json
{
  "success": false,
  "code": "7242",
  "codes": [
    {
      "code": "7242",
      "description": "Invalid request data"
    }
  ],
  "message": "GePG rejected the expiry change: Invalid request data",
  "data": {
    "billSubReqAck": {
      "AckStsCode": "7242",
      "AckStsDesc": "Invalid request data"
    }
  }
}
```

Response 404: No such bill among your bills

```json
{
  "success": false,
  "code": "7204",
  "message": "Bill not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Cancel a bill

`POST /api/v1/bills/{billId}/cancel`

Cancels a bill that has not been paid in full. You get a bill.cancelled event.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `billId` | path | yes | Your own reference for the bill (the billId you sent when creating it). | `INV-1001` |

Request body (JSON):

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | yes | Why it is being cancelled. |

Example:

```json
{
  "reason": "Duplicate bill"
}
```

Request with curl:

```bash
curl -X POST 'http://localhost:5001/api/v1/bills/INV-1001/cancel' \
  -H 'X-Api-Key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
  "reason": "Duplicate bill"
}'
```

Response 200: Cancelled

```json
{
  "success": true,
  "message": "Bill cancelled successfully",
  "data": {
    "billCanclRes": {
      "ResId": "GW1763373731001",
      "ReqId": "SP0231763373731001",
      "GrpBillId": "ICDV-INV-1001",
      "CanclSts": "GS",
      "CanclStsCode": "7283",
      "CanclStsDesc": "Bill has been cancelled"
    }
  }
}
```

Response 400: The bill cannot be cancelled in its current state

```json
{
  "success": false,
  "message": "Bill not found or cannot be cancelled"
}
```

Response 502: GePG declined the cancellation

```json
{
  "success": false,
  "code": "7201",
  "message": "GePG declined the cancellation",
  "data": {
    "billCanclRes": {
      "CanclSts": "GF",
      "CanclStsCode": "7201"
    }
  }
}
```

Response 404: No such bill among your bills

```json
{
  "success": false,
  "code": "7204",
  "message": "Bill not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Data for a printable bill

`GET /api/v1/bills/{billId}/print`

Everything needed to print the bill: control number, items, amount in words, payment instructions and the QR message. Only available once the bill has a control number. Add ?type=transfer for the bank-transfer form.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `billId` | path | yes | Your own reference for the bill (the billId you sent when creating it). | `INV-1001` |
| `type` | query | no | bill (default) or transfer. | `bill` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/bills/INV-1001/print?type=bill' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: Print data (trimmed)

```json
{
  "success": true,
  "data": {
    "type": "bill",
    "title": "Government Bill",
    "bill": {
      "controlNumber": "991330026625",
      "billReference": "ICDV-INV-1001",
      "payerName": "Vidah Mwakyusa",
      "total": "500,000.00",
      "currency": "TZS",
      "amountInWords": "Five Hundred Thousand Tanzanian Shilling Only.",
      "expiresOn": "17-Dec-2027"
    },
    "qr": {
      "payload": {
        "opType": "2",
        "shortCode": "001001",
        "billReference": "991330026625",
        "amount": "500000.00"
      }
    },
    "warnings": []
  }
}
```

Response 409: Not approved yet

```json
{
  "success": false,
  "message": "Bill has no control number yet (status PENDING). It can be printed once GePG approves it."
}
```

Response 404: No such bill among your bills

```json
{
  "success": false,
  "code": "7204",
  "message": "Bill not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

### Payments

Payments received on your bills.

#### List payments

`GET /api/v1/payments`

Payments on your own bills, newest first.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `page` | query | no | Page number, starting at 1. | `1` |
| `limit` | query | no | Payments per page. | `20` |
| `billId` | query | no | Only payments on this bill (your own reference). | `INV-1001` |
| `startDate` | query | no | Paid on or after (YYYY-MM-DD). Use with endDate. | `2026-11-01` |
| `endDate` | query | no | Paid on or before (YYYY-MM-DD). | `2026-11-30` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/payments?page=1&limit=20' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: A page of payments (trimmed)

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "transaction_id": "T1001",
      "pay_ref_id": "99015046706",
      "bill_id": "ICDV-INV-1001",
      "payment_control_number": "991330026625",
      "bill_amount": "500000.00",
      "paid_amount": "300000.00",
      "currency": "TZS",
      "transaction_datetime": "2026-11-16T09:35:00.000Z",
      "used_payment_channel": "MB",
      "psp_name": "Example Bank",
      "payment_type": "OFFLINE",
      "status": "PENDING"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Get one payment

`GET /api/v1/payments/{paymentId}`

One payment on your bills.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `paymentId` | path | yes | The payment id from the list or an event. | `12` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/payments/12' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: The payment (trimmed)

```json
{
  "success": true,
  "data": {
    "id": 12,
    "transaction_id": "T1001",
    "pay_ref_id": "99015046706",
    "bill_id": "ICDV-INV-1001",
    "payment_control_number": "991330026625",
    "bill_amount": "500000.00",
    "paid_amount": "300000.00",
    "currency": "TZS",
    "transaction_datetime": "2026-11-16T09:35:00.000Z",
    "used_payment_channel": "MB",
    "psp_name": "Example Bank",
    "payment_type": "OFFLINE",
    "status": "PENDING"
  }
}
```

Response 404: Not found among your payments

```json
{
  "success": false,
  "message": "Payment not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

#### Data for a printable receipt

`GET /api/v1/payments/{paymentId}/receipt`

Everything needed to print the GePG receipt for a payment.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `paymentId` | path | yes | The payment id. | `12` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/payments/12/receipt' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: Receipt data (trimmed)

```json
{
  "success": true,
  "data": {
    "type": "receipt",
    "title": "Exchequer Receipts",
    "receipt": {
      "receiptNumber": "99015046706",
      "receivedFrom": "Vidah Mwakyusa",
      "amount": "300,000.00",
      "currency": "TZS",
      "amountInWords": "Three Hundred Thousand Tanzanian Shilling Only.",
      "outstandingBalance": "200,000.00",
      "controlNumber": "991330026625",
      "paymentDate": "16-Nov-2026"
    }
  }
}
```

Response 404: Not found among your payments

```json
{
  "success": false,
  "message": "Payment not found"
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

### Events feed

The same events that are sent to your callback URL, for you to collect.

#### Collect your events

`GET /api/v1/events`

Your events in order, oldest first. Keep the nextCursor of the last batch you processed and ask for what came after it. Use this to catch up after downtime, or as your whole integration if you have no callback URL.

| Parameter | In | Required | Description | Example |
|---|---|---|---|---|
| `after` | query | no | Cursor: only events after this one. Start with 0. | `0` |
| `limit` | query | no | Events per call, 1 to 500. Defaults to 100. | `100` |

Request with curl:

```bash
curl -X GET 'http://localhost:5001/api/v1/events?after=0&limit=100' \
  -H 'X-Api-Key: YOUR_API_KEY'
```

Response 200: Events and the next cursor

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "183",
        "type": "bill.approved",
        "createdAt": "2026-11-16T09:35:12.000Z",
        "bill": {
          "billId": "INV-1001",
          "gepgBillId": "ICDV-INV-1001",
          "controlNumber": "991330026625",
          "status": "APPROVED"
        }
      },
      {
        "id": "184",
        "type": "payment.received",
        "createdAt": "2026-11-16T09:35:12.000Z",
        "bill": {
          "billId": "INV-1001",
          "gepgBillId": "ICDV-INV-1001",
          "controlNumber": "991330026625",
          "status": "APPROVED"
        },
        "payment": {
          "receiptNumber": "99015046706",
          "transactionId": "T1001",
          "paidAmount": 300000,
          "currency": "TZS",
          "channel": "MB",
          "psp": "Example Bank",
          "paidAt": "2026-11-16T09:35:00",
          "payerName": null,
          "payerPhone": null
        },
        "totals": {
          "billAmount": 500000,
          "totalPaid": 300000,
          "remaining": 200000,
          "isPaid": false
        },
        "source": "gepg"
      }
    ],
    "nextCursor": "184"
  }
}
```

Response 401: Missing or wrong API key

```json
{
  "success": false,
  "message": "Invalid or disabled API key"
}
```

Response 403: Key not linked to an active billing system

```json
{
  "success": false,
  "message": "This API key is not linked to a billing system. Ask an admin to link it."
}
```

## 4. Events

Your billing system is told what happens to its bills with these events. They are sent to your callback URL (section 5) and are also in the events feed (`GET /api/v1/events`).

| Event | When |
|---|---|
| `bill.approved` | GePG accepted the bill. It now has a control number the payer can use. |
| `bill.rejected` | GePG refused the bill. reason.code and reason.description say why. |
| `payment.received` | A payment arrived. It is also sent for a payment recovered by reconciliation (source is "reconciliation"). A bill paid in parts gives one of these per payment. |
| `bill.paid` | The payments now cover the billed amount. Sent once, right after the payment.received that settled it. |
| `bill.cancelled` | The bill was cancelled. |
| `bill.expired` | An approved bill passed its expiry date without being fully paid. totals shows what is still due. |

#### bill.approved

```json
{
  "id": "184",
  "type": "bill.approved",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": "991330026625",
    "status": "APPROVED"
  }
}
```

#### bill.rejected

```json
{
  "id": "184",
  "type": "bill.rejected",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": null,
    "status": "REJECTED"
  },
  "reason": {
    "code": "7223",
    "description": "Invalid or inactive GFS code or service type"
  }
}
```

#### payment.received

```json
{
  "id": "184",
  "type": "payment.received",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": "991330026625",
    "status": "APPROVED"
  },
  "payment": {
    "receiptNumber": "99015046706",
    "transactionId": "T1001",
    "paidAmount": 300000,
    "currency": "TZS",
    "channel": "MB",
    "psp": "Example Bank",
    "paidAt": "2026-11-16T09:35:00",
    "payerName": null,
    "payerPhone": null
  },
  "totals": {
    "billAmount": 500000,
    "totalPaid": 300000,
    "remaining": 200000,
    "isPaid": false
  },
  "source": "gepg"
}
```

#### bill.paid

```json
{
  "id": "184",
  "type": "bill.paid",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": "991330026625",
    "status": "PAID"
  },
  "totals": {
    "billAmount": 500000,
    "totalPaid": 500000,
    "remaining": 0,
    "isPaid": true
  }
}
```

#### bill.cancelled

```json
{
  "id": "184",
  "type": "bill.cancelled",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": "991330026625",
    "status": "CANCELLED"
  }
}
```

#### bill.expired

```json
{
  "id": "184",
  "type": "bill.expired",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": "991330026625",
    "status": "EXPIRED"
  },
  "totals": {
    "billAmount": 500000,
    "totalPaid": 300000,
    "remaining": 200000,
    "isPaid": false
  }
}
```

#### system.test

```json
{
  "id": "184",
  "type": "system.test",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "message": "Test event from the GePG bridge"
}
```

## 5. Receiving events (delivery)

The bridge sends each event to your callback URL as a POST with a JSON body. Answer with any 2xx status to confirm.

Your callback URL: `https://billing.example.com/gepg/events`

### What the bridge sends

| Header | Meaning | Example |
|---|---|---|
| `Content-Type` | Always application/json. | `application/json` |
| `User-Agent` | Identifies the sender. | `GePG-Bridge/1.0` |
| `X-Bridge-Event` | The event type. | `payment.received` |
| `X-Bridge-Event-Id` | The event number. The same event can arrive more than once, so remember the ids you have handled. | `184` |
| `X-Bridge-Delivery-Attempt` | 1 for the first try, 2 for the first retry, and so on. | `1` |
| `X-Bridge-Timestamp` | When this attempt was signed, in unix seconds. | `1763373731` |
| `X-Bridge-Signature` | How to check the sender: t=<timestamp>,v1=<signature>. See "Check the signature". | `t=1763373731,v1=3b1c68cb39862d432b0ce13a12a3ee7242627e6bbb23e64e09afadb77781a4b4` |

Sample request (the body is exactly what is signed):

```http
POST https://billing.example.com/gepg/events HTTP/1.1
Content-Type: application/json
User-Agent: GePG-Bridge/1.0
X-Bridge-Event: payment.received
X-Bridge-Event-Id: 184
X-Bridge-Delivery-Attempt: 1
X-Bridge-Timestamp: 1763373731
X-Bridge-Signature: t=1763373731,v1=3b1c68cb39862d432b0ce13a12a3ee7242627e6bbb23e64e09afadb77781a4b4

{"id":"184","type":"payment.received","createdAt":"2026-11-16T09:35:12.000Z","bill":{"billId":"INV-1001","gepgBillId":"ICDV-INV-1001","controlNumber":"991330026625","status":"APPROVED"},"payment":{"receiptNumber":"99015046706","transactionId":"T1001","paidAmount":300000,"currency":"TZS","channel":"MB","psp":"Example Bank","paidAt":"2026-11-16T09:35:00","payerName":null,"payerPhone":null},"totals":{"billAmount":500000,"totalPaid":300000,"remaining":200000,"isPaid":false},"source":"gepg"}
```

The same body, formatted:

```json
{
  "id": "184",
  "type": "payment.received",
  "createdAt": "2026-11-16T09:35:12.000Z",
  "bill": {
    "billId": "INV-1001",
    "gepgBillId": "ICDV-INV-1001",
    "controlNumber": "991330026625",
    "status": "APPROVED"
  },
  "payment": {
    "receiptNumber": "99015046706",
    "transactionId": "T1001",
    "paidAmount": 300000,
    "currency": "TZS",
    "channel": "MB",
    "psp": "Example Bank",
    "paidAt": "2026-11-16T09:35:00",
    "payerName": null,
    "payerPhone": null
  },
  "totals": {
    "billAmount": 500000,
    "totalPaid": 300000,
    "remaining": 200000,
    "isPaid": false
  },
  "source": "gepg"
}
```

### What your system answers

**Accepted (this is all that is needed)**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"received":true}
```

Delivered. The body is ignored; any 2xx works.

**Accepted, no body**

```http
HTTP/1.1 204 No Content
```

Delivered.

**Signature did not match**

```http
HTTP/1.1 401 Unauthorized
```

Not delivered. The bridge tries again later.

**Your system failed**

```http
HTTP/1.1 500 Internal Server Error
```

Not delivered. The bridge tries again later.

Counted as a failure (the bridge tries again later):

- Any status outside 200 to 299, including 3xx redirects (the bridge does not follow them) and 4xx errors.
- No answer within 10 seconds.
- The connection cannot be made (server down, wrong address, certificate problem).

### Check the signature

1. Read the raw body exactly as received, before any JSON parsing.
2. Take t and v1 from the X-Bridge-Signature header.
3. Reject the delivery if t is more than 5 minutes away from your clock. This stops someone replaying an old delivery.
4. Compute HMAC-SHA256 over the text "<t>.<raw body>" with your signing secret, as lowercase hex.
5. Compare it with v1 in constant time. If they differ, reject the delivery (answer 401).

Node:

```js
const crypto = require('crypto');

// rawBody must be the body exactly as received, before any JSON parsing
function verify(rawBody, header, secret) {
  const [, t, v1] = /t=(\d+),v1=([0-9a-f]+)/.exec(header || '') || [];
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + rawBody).digest('hex');
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

Php:

```php
<?php
// $rawBody must be the body exactly as received: file_get_contents('php://input')
function verify(string $rawBody, string $header, string $secret): bool {
    if (!preg_match('/t=(\d+),v1=([0-9a-f]+)/', $header, $m)) return false;
    if (abs(time() - (int)$m[1]) > 300) return false;
    return hash_equals(hash_hmac('sha256', $m[1] . '.' . $rawBody, $secret), $m[2]);
}
```

Python:

```python
import hmac, hashlib, re, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    m = re.search(r"t=(\d+),v1=([0-9a-f]+)", header or "")
    if not m or abs(time.time() - int(m.group(1))) > 300:
        return False
    expected = hmac.new(secret.encode(), m.group(1).encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, m.group(2))
```

A minimal receiving endpoint:

Node:

```js
const express = require('express');
const app = express();

// keep the raw body: the signature is computed over it
app.post('/gepg/events', express.raw({ type: 'application/json' }), (req, res) => {
  const raw = req.body.toString('utf8');
  if (!verify(raw, req.get('X-Bridge-Signature'), process.env.BRIDGE_SECRET)) return res.sendStatus(401);

  const event = JSON.parse(raw);
  res.sendStatus(200);          // answer first, then do the work
  handle(event);                // ignore event.id values you have already handled
});
```

Php:

```php
<?php
$raw = file_get_contents('php://input');
if (!verify($raw, $_SERVER['HTTP_X_BRIDGE_SIGNATURE'] ?? '', getenv('BRIDGE_SECRET'))) {
    http_response_code(401);
    exit;
}

$event = json_decode($raw, true);
http_response_code(200);        // answer first, then do the work
echo '{"received":true}';
// ... handle($event); ignore event ids you have already handled
```

Python:

```python
from flask import Flask, request
import os

app = Flask(__name__)

@app.post("/gepg/events")
def gepg_events():
    raw = request.get_data()    # the raw body: the signature is computed over it
    if not verify(raw, request.headers.get("X-Bridge-Signature"), os.environ["BRIDGE_SECRET"]):
        return "", 401
    event = request.get_json()
    # answer first, then do the work; ignore event ids you have already handled
    return {"received": True}, 200
```

### Test your signature code

Check your verification code against this before connecting anything. It uses a fixed example secret and a fixed timestamp, so skip the 5-minute clock check for this one test.

| Item | Value |
|---|---|
| Signing secret | `whsec_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| Timestamp (t) | `1763373731` |
| Signed text | the timestamp, a dot, then the body below |
| Expected signature (v1) | `3b1c68cb39862d432b0ce13a12a3ee7242627e6bbb23e64e09afadb77781a4b4` |
| Header | `t=1763373731,v1=3b1c68cb39862d432b0ce13a12a3ee7242627e6bbb23e64e09afadb77781a4b4` |

Body:

```json
{"id":"184","type":"payment.received","createdAt":"2026-11-16T09:35:12.000Z","bill":{"billId":"INV-1001","gepgBillId":"ICDV-INV-1001","controlNumber":"991330026625","status":"APPROVED"},"payment":{"receiptNumber":"99015046706","transactionId":"T1001","paidAmount":300000,"currency":"TZS","channel":"MB","psp":"Example Bank","paidAt":"2026-11-16T09:35:00","payerName":null,"payerPhone":null},"totals":{"billAmount":500000,"totalPaid":300000,"remaining":200000,"isPaid":false},"source":"gepg"}
```

### Retries

The bridge keeps trying until the system's retry window ends (an admin picks 24 hours to 14 days; 72 hours by default). The last try is made at the end of the window. After that the event shows as Failed in the Outbox, and an admin can send it again.

After each failed try the bridge waits: 1 minute, 5 minutes, 15 minutes, 1 hour, 3 hours, 6 hours, 12 hours, then every 24 hours.

Retry windows an admin can choose: 24 hours, 48 hours, 72 hours (default), 7 days, 14 days.

- Delivery is at least once: the same event can arrive twice. Remember the event ids you have handled.
- Events are not guaranteed to arrive in order. Use the event id (it only grows) or createdAt if order matters.
- Answer quickly, then do the work: a slow answer counts as a failure after 10 seconds.
- If you were down, collect what you missed from the events feed (GET /api/v1/events?after=...).

## 6. Errors

| Status | Meaning |
|---|---|
| 200 | Done. |
| 201 | Created. For a bill this means GePG received it; the control number follows as an event. |
| 400 | A value is not valid. code and message say which; errors lists each field. |
| 401 | No API key, or the key is wrong or deleted. |
| 403 | The key is not linked to a billing system, or the system is disabled. |
| 404 | No such bill or payment among yours (also when it belongs to another system). |
| 409 | You already used this billId. |
| 422 | GePG refused the request. code and codes say why (see the GePG codes). |
| 502 | GePG declined a cancellation. |
| 500 | The bridge failed. Try again; tell an admin if it keeps happening. |

The code in an error response is a GePG response code. Common ones: 7242 invalid request data, 7223 invalid GFS code, 7226 duplicate bill, 7204 bill does not exist, 7231 wrong expiry date.

| GePG code | Meaning |
|---|---|
| `7101` | Successful |
| `7102` | Failure |
| `7201` | Failure |
| `7202` | Required header is not given |
| `7203` | Unauthorized |
| `7204` | Bill does not exist |
| `7205` | Invalid service provider |
| `7206` | Service provider is not active |
| `7207` | Duplicate payment |
| `7208` | Invalid business account |
| `7209` | Business account is not active |
| `7210` | Collection account balance limit reached |
| `7211` | Payment service provider code did not match Bill service provider code |
| `7212` | Payment currency did not match Bill currency |
| `7213` | Bill has expired |
| `7214` | Insufficient amount paid |
| `7215` | Invalid payment service provider |
| `7216` | Payment service provider is not active |
| `7217` | No payer email or phone number |
| `7218` | Wrong payer identity |
| `7219` | Wrong currency |
| `7220` | Sub service provider is inactive |
| `7221` | Wrong bill equivalent amount |
| `7222` | Wrong bill miscellaneous amount |
| `7223` | Invalid or inactive GFS code or service type |
| `7224` | Wrong bill amount |
| `7225` | Invalid bill reference number or code |
| `7226` | Duplicate bill information |
| `7227` | Blank bill identification number |
| `7228` | Invalid sub service provider |
| `7229` | Wrong bill item GFS or payment type code |
| `7230` | Wrong bill generation date |
| `7231` | Wrong bill expiry date |
| `7232` | Consumer already started by another process |
| `7233` | Consumer already stopped by another process |
| `7234` | Wrong bill payment option |
| `7235` | Bill creation completed successfully |
| `7236` | Bill creation completed with errors |
| `7237` | Bill detail creation completed successfully |
| `7238` | Bill detail creation completed with errors |
| `7239` | No external bill system settings found |
| `7240` | Failed to save transaction |
| `7241` | Invalid session |
| `7242` | Invalid request data |
| `7243` | Invalid credit account |
| `7244` | Invalid transfer amount |
| `7245` | Invalid credit account name |
| `7246` | Invalid debit account |
| `7247` | Invalid transfer transaction description |
| `7279` | Bill already settled |
| `7281` | Invalid payment transaction date |
| `7283` | Bill has been cancelled |
| `7284` | Payment currency did not match collection account currency |
| `7289` | Invalid batch generated date |
| `7290` | Total batch amount cannot be zero (0) |
| `7291` | Total batch amount is not equal to summation of items (transactions) |
| `7297` | Inactive currency |
| `7301` | Bill has been paid partially |
| `7302` | Paid amount is not exact billed amount |
| `7303` | Invalid signature |
| `7304` | Invalid signature configuration, missing one of the parameters |
| `7305` | Invalid batch start and end date |
| `7306` | Batch has no item (transaction) |
| `7307` | Inconsistency in batch start, end and generated date |
| `7311` | Invalid GePG configurations, missing one of the parameters |
| `7317` | Error on processing request |
| `7318` | Invalid reconciliation request date |
| `7319` | Reconciliation request date is out of allowable range |
| `7321` | Request cannot complete at this time, try later |
| `7322` | Inactive communication protocol |
| `7323` | Invalid code, mismatch of supplied code on information and header |
| `7333` | Invalid bill control number |
| `7335` | Requested bill control number does not exist |
| `7336` | Requested bill amount has reached the maximum payable limit |
| `7337` | Requested resource is not available |
