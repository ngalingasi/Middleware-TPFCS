import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Separate axios instance from the legacy ICDV `client.ts` - the GePG
// bridge backend has its own base URL, its own single-JWT auth (no
// refresh tokens), and its own response shape ({ success, data, ... }).
// Checked in order: runtime config.js (editable on the server, no rebuild
// needed) -> build-time VITE_GEPG_API_URL -> hardcoded local dev default.
const BASE_URL =
  (window as any).__RUNTIME_CONFIG__?.GEPG_API_URL ??
  import.meta.env.VITE_GEPG_API_URL ??
  'http://localhost:5001/api';

const gepgClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

const TOKEN_KEY = 'gepg_token';
const USER_KEY = 'gepg_user';

gepgClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The backend issues a single long-lived JWT (default 7d) and has no
// refresh-token endpoint - on 401 we just clear the session and bounce
// to sign-in, rather than the ICDV client's refresh-and-retry dance.
gepgClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== '/signin') {
        window.location.href = '/signin';
      }
    }
    return Promise.reject(error);
  }
);

export { TOKEN_KEY, USER_KEY };
export default gepgClient;
