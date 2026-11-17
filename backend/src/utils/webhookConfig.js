// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Webhook settings shared by delivery and the developer documentation
// └──────────────────────────────────────────────────────────────────────────┘

const crypto = require('crypto');

const EVENT_TYPES = ['bill.approved', 'bill.rejected', 'payment.received', 'bill.paid', 'bill.cancelled', 'bill.expired', 'system.test'];

// seconds to wait after the 1st, 2nd, 3rd... failed attempt; the last value repeats
const BACKOFF_SECONDS = [60, 300, 900, 3600, 10800, 21600, 43200, 86400];
const TIMEOUT_MS = 10000;

// receivers should reject a delivery whose timestamp is older than this
const SIGNATURE_TOLERANCE_SECONDS = 300;

// retry windows an admin can pick from (hours)
const RETRY_WINDOWS = [24, 48, 72, 168, 336];
const DEFAULT_RETRY_WINDOW = 72;

// t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<body>">, so receivers can reject replays
function sign(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

module.exports = {
  EVENT_TYPES, BACKOFF_SECONDS, TIMEOUT_MS, SIGNATURE_TOLERANCE_SECONDS,
  RETRY_WINDOWS, DEFAULT_RETRY_WINDOW, sign
};
