// Runtime configuration for the GePG frontend.
//
// This file is served as-is (not bundled by Vite) and loaded by index.html
// BEFORE the app's JS bundle. Edit the values below directly on the server
// to change the API base URL - no rebuild or redeploy needed, just refresh
// the page.
//
// Leave a value as '/api' when the frontend and backend are served from
// the same domain via an Apache/Nginx reverse proxy (the normal production
// setup). Only change this if the API is genuinely on a different origin.
window.__RUNTIME_CONFIG__ = {
  API_URL: '/api',
  GEPG_API_URL: '/api',
};
