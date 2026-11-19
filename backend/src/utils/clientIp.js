// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 18/11/2026
// │ Client IP: the caller's real address, as a plain string
// └──────────────────────────────────────────────────────────────────────────┘

// With `trust proxy` set (server.js), req.ip is the address nginx saw in
// X-Forwarded-For, not nginx's own. IPv4 addresses that arrive in IPv6 form
// (::ffff:1.2.3.4) are written the usual way.
function clientIp(req) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

// the whole chain, for the log: who the proxy said it was, and what it forwarded
function forwardedFor(req) {
  const chain = req.headers['x-forwarded-for'];
  return chain ? String(chain).slice(0, 255) : null;
}

module.exports = { clientIp, forwardedFor };
