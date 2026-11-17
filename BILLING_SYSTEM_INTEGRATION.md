# Connecting a billing system to the GePG bridge

The bridge sits between your billing system and GePG. You send bills to the bridge; the bridge sends them to GePG, and tells you when GePG answers and when a payment arrives.

```
billing system ──bill──► bridge ──signed bill──► GePG
billing system ◄─event── bridge ◄──payment────── GePG
billing system ──"is it paid?"──► bridge
```

## 1. Get set up (an admin does this)

1. **Billing Systems** page: add your system. Pick a short **code** (for example `ICDV`). It cannot be changed later.
2. Optionally set a **callback URL** (http or https) where the bridge sends events. Leave it empty if you would rather collect events yourself (section 5).
3. Copy the **signing secret** shown once. You use it to check that events really come from the bridge.
4. Open **Keys** for your system and create an **API key**. Copy it once.

Test it: `GET /api/v1/ping` with your key returns your system code. The **Test** button on the Billing Systems page sends your callback URL a signed test event.

## 2. Calling the bridge

Send your API key in the `X-Api-Key` header. A key belongs to one system and only ever sees that system's bills and payments.

| What | Call |
|---|---|
| Create a bill and send it to GePG | `POST /api/v1/bills` |
| Many bills at once (up to 100) | `POST /api/v1/bills/bulk` with `{ "bills": [ ... ] }` |
| Reuse a control number | `POST /api/v1/bills/reuse` |
| One bill | `GET /api/v1/bills/{billId}` and `GET /api/v1/bills/{billId}/status` |
| Many bill statuses | `POST /api/v1/bills/status` with `{ "billIds": ["INV-1", "INV-2"] }` (up to 100) |
| Your bills | `GET /api/v1/bills?status=&page=&limit=` |
| Extend an expiry date | `POST /api/v1/bills/{billId}/extend` with `{ "billExpiryDate", "reason" }` |
| Cancel | `POST /api/v1/bills/{billId}/cancel` with `{ "reason" }` |
| Printable bill data | `GET /api/v1/bills/{billId}/print` |
| Payments | `GET /api/v1/payments`, `GET /api/v1/payments/{id}`, `GET /api/v1/payments/{id}/receipt` |
| Events | `GET /api/v1/events?after=0&limit=100` |

`{billId}` is **your own reference**. The bridge puts your system code in front when it talks to GePG (`ICDV-INV-1001`), so two systems can use the same invoice numbers. Responses give both: `billId` (yours) and `gepgBillId`. Using a reference twice gives `409` with code `7226`.

### Creating a bill

```json
{
  "billId": "INV-1001",
  "billAmount": 500000,
  "billEquivAmount": 500000,
  "billExpiryDate": "2027-12-17T12:00:00",
  "payerId": "P1",
  "payerName": "Vidah Mwakyusa",
  "payerCellNumber": "255786030028",
  "payerEmail": "vidah@example.com",
  "billDescription": "Sale of tender",
  "currency": "TZS",
  "billPayOption": 1,
  "items": [
    { "billItemRef": "TND-77", "billItemAmount": 350000, "billItemEquivAmount": 350000, "gfsCode": "140368" }
  ]
}
```

Amounts must be greater than zero and every `gfsCode` must be active in the bridge's GFS list. A refused request answers with `code` and `message`, and the code is one of GePG's (for example `7242` invalid data, `7223` invalid GFS code).

The control number does not come back in this response. GePG sends it a moment later, as the `bill.approved` event.

## 3. Events

| Event | When |
|---|---|
| `bill.approved` | GePG accepted the bill; it now has a control number |
| `bill.rejected` | GePG refused it (`reason.code` and `reason.description` say why) |
| `payment.received` | A payment arrived (also when it is recovered by reconciliation: `source` is `reconciliation`) |
| `bill.paid` | The payments now cover the billed amount |
| `bill.cancelled` | The bill was cancelled |
| `bill.expired` | An approved bill passed its expiry date |

Example:

```json
{
  "id": "184",
  "type": "payment.received",
  "createdAt": "2026-11-17T10:02:11.000Z",
  "bill": { "billId": "INV-1001", "gepgBillId": "ICDV-INV-1001", "controlNumber": "991330026625", "status": "APPROVED" },
  "payment": { "receiptNumber": "99015046706", "transactionId": "T1", "paidAmount": 300000, "currency": "TZS",
               "channel": "MB", "psp": "Test Bank", "paidAt": "2026-11-16T09:35:00", "payerName": null, "payerPhone": null },
  "totals": { "billAmount": 500000, "totalPaid": 300000, "remaining": 200000, "isPaid": false },
  "source": "gepg"
}
```

A bill paid in parts produces several `payment.received` events and one `bill.paid`.

## 4. Receiving events at your callback URL

Every delivery is `POST` with a JSON body and these headers:

- `X-Bridge-Event`: the event type
- `X-Bridge-Event-Id`: the event's number
- `X-Bridge-Delivery-Attempt`: 1 for the first try
- `X-Bridge-Signature`: `t=<unix seconds>,v1=<hex>`

**Check the signature**: `v1` is the hex HMAC-SHA256 of `<t>.<raw body>` using your signing secret. Reject the delivery if it does not match, or if `t` is more than 5 minutes old.

Node:

```js
const crypto = require('crypto');
function verify(rawBody, header, secret) {
  const [, t, v1] = /t=(\d+),v1=([0-9a-f]+)/.exec(header) || [];
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

PHP:

```php
function verify(string $rawBody, string $header, string $secret): bool {
    if (!preg_match('/t=(\d+),v1=([0-9a-f]+)/', $header, $m)) return false;
    if (abs(time() - (int)$m[1]) > 300) return false;
    return hash_equals(hash_hmac('sha256', $m[1] . '.' . $rawBody, $secret), $m[2]);
}
```

Use the **raw** body (before any JSON parsing).

**Answer with any 2xx status** to confirm. Anything else, or no answer within 10 seconds, is retried: after 1 minute, 5 minutes, 15 minutes, 1 hour, 3 hours, 6 hours, 12 hours, then daily, until the system's **retry window** ends (24 hours to 14 days; 72 hours by default). After that the event shows as failed in the Outbox and an admin can send it again.

Delivery is **at least once**, so the same event can arrive twice: remember the `id`s you have handled. Events are not guaranteed to arrive in order; use `createdAt` or the `id` number if order matters.

Answer quickly and process afterwards: do the heavy work after you have replied.

## 5. Pulling instead of (or as well as) receiving

`GET /api/v1/events?after=<cursor>&limit=100` returns your events in order, oldest first, with a `nextCursor`. Keep the last cursor you processed and ask for what came after it. This is also how to catch up after your system was down, and the whole integration for a system with no callback URL.

```json
{ "success": true, "data": { "events": [ ... ], "nextCursor": "184" } }
```

For "is this bill paid?" without events, call `GET /api/v1/bills/{billId}/status` (or the batch `POST /api/v1/bills/status`). `isPaid` is true only when payments cover the whole amount; `remaining` says how much is still due.

## 6. Good to know

- Reconciliation with GePG is done by the bridge, not by billing systems. Payments it recovers reach you as normal `payment.received` events.
- A bill that expires is marked `EXPIRED` by the bridge; to bill the same payer again use **reuse** with the old control number.
- If your system is disabled by an admin, its key stops working and its events wait until it is enabled again.
