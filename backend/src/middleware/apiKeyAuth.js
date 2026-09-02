const ApiKey = require('../models/ApiKey');

/**
 * Authenticates a request using the X-Api-Key header instead of a user JWT.
 * Used by external/child systems calling this bridge programmatically
 * (e.g. to create bills) without a dashboard login.
 *
 * Not used directly on routes - see middleware/authenticateAny.js, which
 * wraps this together with the JWT authenticate() check so Bills/Payments/
 * Reconciliation routes accept either credential.
 */
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

    await ApiKey.touchLastUsed(key.id);
    req.apiKey = { id: key.id, name: key.name };
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
}

module.exports = apiKeyAuth;
