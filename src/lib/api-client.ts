import axios, { AxiosError } from 'axios';
import { useAuthStore } from './auth-store';
import { IS_DEMO } from './demo/config';
import { demoAdapter } from './demo/adapter';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the httpOnly refresh_token cookie on refresh calls.
  withCredentials: true,
});

// DEMÓ MÓD: minden kérést a böngészőben futó mock-router szolgál ki, valós
// backend nélkül. Élesben (NEXT_PUBLIC_DEMO_MODE != 'true') ez nem aktív.
if (IS_DEMO) {
  apiClient.defaults.adapter = demoAdapter;
}

apiClient.interceptors.request.use((config) => {
  const { accessToken, tenantId } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  const tid = tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || null;
  if (tid) config.headers['x-tenant-id'] = tid;
  return config;
});

// Single-flight refresh: ha egyszerre több 401-es kérés jön, csak egy
// /auth/refresh hívás megy ki, a többi várja annak eredményét.
let refreshPromise: Promise<string> | null = null;

function runRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      // The API reads the refresh token exclusively from the httpOnly cookie.
      // No body payload is needed or accepted.
      const res = await axios.post('/api/v1/auth/refresh', undefined, {
        withCredentials: true,
      });
      const { accessToken } = res.data as { accessToken: string };
      useAuthStore.getState().setAuth(accessToken);
      return accessToken;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (!original) return Promise.reject(error);

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const accessToken = await runRefresh();
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch (refreshErr) {
        // Csak akkor logout, ha a refresh maga 401/403-ra esett (lejárt/visszavont
        // refresh token). Hálózati hibánál (timeout, ERR_NETWORK, 5xx) ne dobjuk ki
        // a usert — később még újra próbálkozhat.
        const status = (refreshErr as AxiosError).response?.status;
        if (status === 401 || status === 403) {
          useAuthStore.getState().clearAuth();
        }
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  },
);
