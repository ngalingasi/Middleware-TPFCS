// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Authenticate any middleware
// └──────────────────────────────────────────────────────────────────────────┘

const { authenticate } = require('./auth');
const apiKeyAuth = require('./apiKeyAuth');

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
