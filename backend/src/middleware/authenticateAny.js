const { authenticate } = require('./auth');
const apiKeyAuth = require('./apiKeyAuth');

/**
 * Accepts either the dashboard's JWT session (Authorization: Bearer <token>,
 * sets req.user) or a child system's API key (X-Api-Key header, sets
 * req.apiKey) - whichever credential is present is the one validated.
 *
 * Used on routes that both this bridge's own frontend AND an external
 * child system need to call (Bills/Payments/Reconciliation CRUD) - GePG's
 * inbound webhook routes are NOT wrapped in this, since GePG authenticates
 * those via digital signature instead, not either of these schemes.
 */
async function authenticateAny(req, res, next) {
  const hasApiKey = Boolean(req.headers['x-api-key']);
  const hasBearer = Boolean(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));

  if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  }

  if (hasBearer) {
    return authenticate(req, res, next);
  }

  return res.status(401).json({
    success: false,
    message: 'Authentication required: provide a Bearer token or an X-Api-Key header.'
  });
}

module.exports = authenticateAny;
