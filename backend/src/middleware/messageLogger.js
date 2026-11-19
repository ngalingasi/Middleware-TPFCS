// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Message logger: keeps the raw body of every call from a billing system and from GePG
// └──────────────────────────────────────────────────────────────────────────┘

const logService = require('../services/logService');
const { clientIp, forwardedFor } = require('../utils/clientIp');

// the three addresses shared with GePG
const GEPG_CALLBACKS = [
  ['/api/bills/webhook/response', 'bill_response'],
  ['/api/payments/webhook/notification', 'payment_notification'],
  ['/api/reconciliation/webhook/response', 'reconciliation_response']
];

const first = (text, pattern) => {
  const match = pattern.exec(text || '');
  return match ? match[1].trim() : null;
};

function describeClientCall(req, raw) {
  const fromBody = first(raw, /"billId"\s*:\s*"([^"]+)"/i);
  const fromPath = first(req.originalUrl.split('?')[0], /\/bills\/([^/]+)(?:\/|$)/);
  return {
    billId: fromBody || (fromPath && !['create', 'list', 'bulk'].includes(fromPath) ? fromPath : null),
    reference: first(raw, /"(?:externalRef|reference)"\s*:\s*"([^"]+)"/i)
  };
}

function messageLogger(req, res, next) {
  const started = process.hrtime.bigint();
  const url = req.originalUrl.split('?')[0];
  const callback = GEPG_CALLBACKS.find(([prefix]) => url === prefix);

  let responseBody = null;
  const originalSend = res.send;
  res.send = function (data) {
    if (responseBody === null) {
      responseBody = Buffer.isBuffer(data) ? data.toString('utf8') : typeof data === 'string' ? data : JSON.stringify(data);
    }
    return originalSend.call(this, data);
  };

  res.on('finish', () => {
    try {
      const fromBillingSystem = !!req.billingSystem;
      if (!fromBillingSystem && !callback) return;

      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const raw = typeof req.rawBody === 'string' ? req.rawBody : typeof req.body === 'string' ? req.body : Object.keys(req.body || {}).length ? JSON.stringify(req.body) : null;
      const base = {
        method: req.method,
        url: req.originalUrl,
        ip: clientIp(req),
        forwardedFor: forwardedFor(req),
        userAgent: req.headers['user-agent'],
        requestHeaders: req.headers,
        requestBody: raw,
        statusCode: res.statusCode,
        responseBody,
        durationMs
      };

      if (callback) {
        const ackCode = first(responseBody, /<AckStsCode>(\d+)<\/AckStsCode>/);
        logService.message({
          ...base,
          direction: 'GEPG_IN',
          operation: callback[1],
          billId: first(raw, /<BillId>([^<]+)<\/BillId>/),
          reference: first(raw, /<(?:ResId|ReqId)>([^<]+)<\/(?:ResId|ReqId)>/),
          ackCode,
          ok: ackCode === '7101',
          error: ackCode && ackCode !== '7101' ? `Answered ${ackCode}` : null
        });
      } else {
        const { billId, reference } = describeClientCall(req, raw);
        logService.message({
          ...base,
          direction: 'CLIENT_IN',
          operation: `${req.method} ${url.replace(/^\/api/, '')}`,
          billingSystemId: req.billingSystem.id,
          billingSystemCode: req.billingSystem.code,
          billId,
          reference,
          ok: res.statusCode < 400,
          error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null
        });
      }
    } catch (error) {
      console.error('Message logging failed:', error.message);
    }
  });

  next();
}

module.exports = messageLogger;
