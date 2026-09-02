# GePG Bridge - API Testing Guide

## Import Collections

`GePG_Bridge_Postman_Collection.json` and `GePG_Bridge_Insomnia.json` are
scoped to **child-system integration**: Bills, Payments, Reconciliation,
and Health Check only. They authenticate every request with an API key
(`X-Api-Key` header), not the dashboard's JWT login - see "Two
Authentication Methods" below. They deliberately exclude the dashboard's
own Auth/Users/Logs/Dashboard-stats endpoints (those are for this bridge's
internal admin UI, not something to hand to a child system) and GePG's
inbound webhook endpoints (GePG calls those directly and authenticates via
digital signature, not either scheme here).

### Postman
1. Open Postman
2. Click "Import" button
3. Select `GePG_Bridge_Postman_Collection.json`
4. Set the collection's `api_key` variable to a key issued by a bridge
   admin (see below), and `base_url` to the bridge's actual address if not
   testing locally.

### Insomnia
1. Open Insomnia
2. Go to Application menu → Preferences → Data
3. Click "Import Data" → "From File"
4. Select `GePG_Bridge_Insomnia.json`
5. Set the `api_key` and `base_url` environment variables as above.

## Two Authentication Methods

Bills/Payments/Reconciliation endpoints accept either credential below
(GePG's webhook endpoints accept neither - they're authenticated via
digital signature instead):

1. **API key** (`X-Api-Key: <key>`) - what the collections above use, and
   what a child system should use. A bridge admin creates one via the
   dashboard (or `POST /api/api-keys`, JWT-authenticated, ADMIN role only).
   The plaintext key is shown **only once**, at creation time - copy it
   immediately and hand it to the child system's integration team. There
   is no way to retrieve it again afterward; only revoke and issue a new
   one (`PATCH /api/api-keys/:id/status`, `DELETE /api/api-keys/:id`).
2. **Dashboard JWT login** (`Authorization: Bearer <token>`, via
   `POST /api/auth/login`) - for this bridge's own frontend, human users
   only. Not part of the shared collections; relevant if you're testing
   the admin dashboard itself rather than the child-system integration.

## Child-System Testing Workflow

### Step 1: Get an API key
As a bridge admin, log into the dashboard (or call `POST /api/auth/login`
then `POST /api/api-keys`) and create a key for the child system. Save the
plaintext key immediately - set it as the collection's `api_key` variable.

### Step 2: Create Bills
1. **Create Bill** - create without submitting
2. **Create and Submit Bill** - create and submit to GePG in one call
3. **Get All Bills** - view created bills
4. **Get Bill by ID** - full bill detail, items, and payment history
5. **Get Bill Status** - lightweight paid/unpaid poll, keyed by your own `billId`

### Step 3: Bill Operations
1. **Submit Bill to GePG** - submit a previously created bill
2. **Cancel Bill** - cancel with a reason

### Step 4: View Payments
1. **Get All Payments** - list all payments
2. **Get Payment by ID** - view payment details
3. **Get Payment Statistics** - payment analytics for a date range

### Step 5: Reconciliation
1. **Submit Reconciliation Request** - ask GePG for a given day's successful-payments batch
2. **Get All Reconciliation Requests** - list requests and their status
3. **Get Reconciliation Request by ID** - view a request's settled transactions

## Testing Scenarios

### Scenario 1: Complete Bill Lifecycle
1. Create and submit a new bill
2. Verify it appears in Get All Bills
3. Poll Get Bill Status until `isPaid`/`remainingAmount` reflect payment
4. Check the fuller Get Bill by ID response for the payment record

### Scenario 2: Payment Flow
1. Create a bill (control number generated after submission)
2. A real payment against that control number triggers GePG's payment
   webhook - not something the child system calls directly
3. Check the payment appears in Get All Payments
4. Confirm Get Bill Status now shows `isPaid: true` and `remainingAmount: 0`

### Scenario 3: Reconciliation
1. Submit a reconciliation request for a past date
2. GePG responds asynchronously; poll Get Reconciliation Request by ID
3. Confirm settled transactions match your own payment records for that date

## Common Issues

### Issue: 401 Unauthorized
**Solution:** Missing or invalid credential. Confirm the `X-Api-Key` header
is set and the key hasn't been disabled/deleted by the admin; a JWT-based
request instead needs a fresh login (tokens expire).

### Issue: 403 Forbidden
**Solution:** Only relevant to JWT-authenticated admin endpoints
(`/api/api-keys`, `/api/users`, `/api/logs`) - these require the ADMIN role.
API-key requests to Bills/Payments/Reconciliation don't have role tiers.

### Issue: 404 Not Found
**Solution:** Check endpoint URL and ensure the resource (billId, payment
id, reconciliation request id) exists.

### Issue: 500 Internal Server Error
**Solution:** Check backend server logs. May be database connectivity or
GePG network issue.

## API Response Codes

| Code | Meaning                | Action Required           |
|------|------------------------|---------------------------|
| 200  | Success                | None                      |
| 201  | Created                | Resource created          |
| 400  | Bad Request            | Check request body        |
| 401  | Unauthorized           | Check X-Api-Key / login token |
| 403  | Forbidden              | Check role permissions    |
| 404  | Not Found              | Verify resource ID        |
| 500  | Server Error           | Check server logs         |

## Security Notes

1. **Never share API keys or tokens over an insecure channel** - both are
   full-access credentials for whatever they're scoped to.
2. **Use HTTPS in production** - never send keys/tokens over plain HTTP.
3. **One key per child system** - makes revoking a compromised or
   decommissioned integration a single `PATCH .../status` call, without
   affecting anyone else.
4. **Rotate on suspicion** - disable and reissue immediately if a key may
   have leaked; there's no way to "see" a key again to confirm it's the
   same one, so treat any doubt as reason to rotate.
5. **Monitor activity logs** - `/api/logs/activity` records which API key
   (by name) made each call, so unusual activity from a given integration
   is traceable.

## Sample Test Data

### Sample Bill
```json
{
  "billId": "TEST-001",
  "billAmount": 50000,
  "billExpiryDate": "2027-12-31T23:59:59",
  "payerId": "TEST-PAYER-001",
  "payerName": "Test User",
  "payerCellNumber": "255712345678",
  "payerEmail": "test@example.com",
  "billDescription": "Test payment",
  "currency": "TZS",
  "billPayOption": 1,
  "items": [
    {
      "billItemRef": "ITEM-001",
      "billItemAmount": 50000,
      "gfsCode": "140206"
    }
  ]
}
```

### Sample Payment Notification (Webhook)
The real webhook (`POST /api/payments/webhook/notification`) receives a
signed XML `pmtSpNtfReq` body, not JSON, and is called by GePG - not by
the child system - so it isn't in the shared collections. The fields below
are shown as JSON only for readability; see GePG API v5.0 section 6.2 for
the full XML shape (`PmtHdr` + `PmtDtls > PmtTrxDtl`).
```json
{
  "transactionId": "TXN001",
  "spCode": "SP023",
  "payRefId": "PAY001",
  "billId": "TEST-001",
  "paymentControlNumber": "990123456789",
  "paidAmount": 50000,
  "currency": "TZS",
  "transactionDateTime": "2027-01-21T10:30:00",
  "usedPaymentChannel": "MOBILE",
  "payerName": "Test User",
  "pspName": "Test Bank",
  "pspCode": "PSP900"
}
```
Note: v5 merged v4's separate online/offline payment notifications into
this single flow - there is no longer a distinct online-notification
webhook or endpoint.

## Advanced Testing

### Load Testing
Use Postman's Collection Runner or Newman CLI to:
1. Run multiple requests sequentially
2. Test with different datasets
3. Measure API response times
4. Verify consistency under load

### Integration Testing
1. Create bill in your system
2. Submit to GePG (mock or real)
3. Verify control number received
4. Simulate payment webhook
5. Verify payment processed
6. Check reconciliation

### Automated Testing
Use collection variables and scripts to:
1. Generate unique bill IDs per run
2. Chain requests together (e.g. feed a created billId into Get Bill Status)
3. Assert response values
4. Generate test reports

## Support

For API issues:
1. Check server logs: `backend/logs/`
2. Verify database connectivity
3. Check GePG network connection
4. Ask a bridge admin to review `/api/logs/activity` for your API key's calls
5. Contact the bridge's system administrator

---

**Remember:** Always test in a development environment before deploying to production!
