// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ API key auth middleware
// └──────────────────────────────────────────────────────────────────────────┘

const ApiKey = require('../models/ApiKey');

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

    await ApiKey.touchLastUsed(key.id);
    req.apiKey = { id: key.id, name: key.name };
    next();
  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
}

module.exports = apiKeyAuth;
