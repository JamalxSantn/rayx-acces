import axios from 'axios';
import { getToken, clearAuth } from './authStore.js';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && getToken()) {
      // Session died (e.g. server restarted and rotated its secret) — bounce to login.
      clearAuth();
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export function apiError(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong.';
}

export default api;
