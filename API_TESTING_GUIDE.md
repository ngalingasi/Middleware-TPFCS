# GePG Bridge: testing the billing system API

Everything a billing system needs to call the bridge and receive its events is in these files. They are **generated** from the bridge's own documentation list, so they match the API exactly. Do not edit them by hand: change the list in `backend/src/utils/apiDocs.js` and run `npm run docs:export`.

| File | Use it for |
|---|---|
| `BILLING_SYSTEM_INTEGRATION.md` | The full guide: every endpoint, the events, how deliveries are signed and retried, error codes |
| `GePG_Bridge_Postman_Collection.json` | Postman: every call with saved sample responses, plus sample deliveries that sign themselves |
| `GePG_Bridge_Insomnia.json` | Insomnia: the same calls |
| `GePG_Bridge_OpenAPI.json` | Swagger, Redoc or code generators. Events are listed under `webhooks` |
| `GePG_Bridge_Webhook_Test.json` | A fixed secret, body and signature to check your signature code against |

The dashboard's Developer page offers the same files, written for one billing system (its code, its callback URL) and with the real server address filled in, which is the best copy to hand to a billing system's team. It can be shown or hidden with `VITE_SHOW_DEVELOPER` in `frontend/.env`.

## For the GePG team

GePG calls the bridge too: it sends the answer to each bill, each payment notification, and the daily payments summary. `GePG_Callbacks_Guide.md`, `GePG_Callbacks_Postman_Collection.json` and `GePG_Callbacks_Insomnia.json` hold the three addresses to register, a sample of each message, and what the bridge answers. Keep these for GePG and the people connecting to GePG; they are not for billing systems.

## Before you start (an admin does this)

1. **Billing Systems** page: add the system, with its code and, if it will receive pushes, its callback URL.
2. Copy the **signing secret** (shown once).
3. Under **Keys** for that system, create an **API key** (shown once).

A key belongs to one system and only ever sees that system's bills and payments. A key that is not linked to a system is refused with 403.

## Postman

1. Import `GePG_Bridge_Postman_Collection.json`.
2. Set the collection variables: `base_url` (the bridge's address) and `api_key`.
3. Run **Connection check**: it should answer with your system code.
4. Run **Create a bill and send it to GePG**. Each run uses a fresh reference, and the collection remembers it as `bill_id` for the next calls.
5. Try **Is this bill paid?**, **List your bills** and **Collect your events**.

A `201` for a bill means GePG received it. The control number follows a moment later as a `bill.approved` event, so look for it in **Collect your events** (the collection keeps the cursor in `events_cursor`), or in the Outbox on the dashboard.

### Sample deliveries to your own endpoint

The last folder sends the bridge's sample events to **your** receiver, signed with a fresh timestamp, the way the bridge does.

1. Set `callback_url` to your endpoint, for example `http://localhost:4000/gepg/events`.
2. Set `webhook_secret` to your system's signing secret. The default is the example secret from the test file.
3. Send one. Your endpoint should check the signature and answer 2xx.

## Insomnia

1. Import `GePG_Bridge_Insomnia.json` (Application, Preferences, Data, Import).
2. Fill the environment: `base_url` and `api_key`; for the sample deliveries also `callback_url`.
3. Insomnia cannot compute a signature, so the sample deliveries carry the fixed test signature. Skip the 5-minute clock check while using them, or use Postman, which signs each one freshly.

## Check your signature code

Open `GePG_Bridge_Webhook_Test.json`. It holds a fixed example secret, timestamp and body, and the signature the bridge's code produces for them. Your verification code must produce the same `expectedSignature` from `"<timestamp>.<body>"` with HMAC-SHA256 as lowercase hex. The guide has working Node, PHP and Python versions; the checker below runs all three against this file.

## Common problems

| You see | Cause |
|---|---|
| 401 | No `X-Api-Key` header, or the key is wrong or was deleted |
| 403 | The key is not linked to a billing system, or the system is disabled |
| 404 | No such bill or payment among yours. Another system's bill also answers 404 |
| 409 with code 7226 | You already used this `billId` |
| 400 | A value is not valid; `message` and `errors` say which |
| 422 | GePG refused the request; `code` and `codes` say why (see the GePG codes in the guide) |

If deliveries never arrive, check the **Outbox** page: it shows every event, its attempts, and what your endpoint answered. The **Test** button on the Billing Systems page sends a signed test event right now.

## Keeping these files current

```
cd backend
npm run docs:check     # fails if a route and its documentation no longer match, or a sample is wrong
npm run docs:export    # rewrites the files above (add a server address: npm run docs:export -- https://bridge.example.com)
```
