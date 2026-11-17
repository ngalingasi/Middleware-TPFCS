// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ API key auth middleware
// └──────────────────────────────────────────────────────────────────────────┘

const ApiKey = require('../models/ApiKey');
const BillingSystem = require('../models/BillingSystem');

// Authenticates a request using the X-Api-Key header instead of a user JWT
async function apiKeyAuth(req, res, next) {
  try {
    const providedKey = req.headers['x-api-key'];

    if (!providedKey) {
      return res.status(401).json({ success: false, message: 'Missing X-Api-Key header' });
    }

    const keyHash = ApiKey.hash(providedKey);
    const key = await ApiKey.findActiveByHash(keyHash);

    if (!key) {
      return res.status(401).json({ success: false, message: 'Invalid or disabled API key' });
    }

    // a key only works as part of a billing system, which is also what keeps each system's data apart
    const system = key.billing_system_id ? await BillingSystem.findById(key.billing_system_id) : null;
    if (!system) {
      return res.status(403).json({ success: false, message: 'This API key is not linked to a billing system. Ask an admin to link it.' });
    }
    if (system.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: `Billing system ${system.code} is disabled` });
    }

    await ApiKey.touchLastUsed(key.id);
    req.apiKey = { id: key.id, name: key.name };
    req.billingSystem = { id: system.id, code: system.code, name: system.name };
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
}

module.exports = apiKeyAuth;
