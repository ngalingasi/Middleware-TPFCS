// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ GePG API client
// └──────────────────────────────────────────────────────────────────────────┘

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

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
