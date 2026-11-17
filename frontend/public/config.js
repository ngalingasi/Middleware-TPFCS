// Runtime configuration for the GePG frontend.
//
// This file is served as-is (not bundled by Vite) and loaded by index.html
// BEFORE the app's JS bundle. Edit the values below directly on the server
// to change the API base URL - no rebuild or redeploy needed, just refresh
// the page (hard refresh: Ctrl/Cmd+Shift+R).
//
// On a real domain (e.g. https://middleware.tpfcs.co.tz) both APIs use '/api':
// nginx forwards /api to the Node backend on the same domain.
//
// When the page is opened from localhost (Vite dev server), the GePG bridge
// backend is on a different origin (port 5001), so it is used directly there.
(function () {
  var isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  window.__RUNTIME_CONFIG__ = {
    API_URL: '/api',
    GEPG_API_URL: isLocalDev ? 'http://localhost:5001/api' : '/api',
  };
})();
