import axios from 'axios';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// El access token dura poco (1h, ver JWT_EXPIRES_IN en el backend) a
// propósito — la sesión larga vive en el refreshToken. Sin esto, cualquier
// petición pasado ese lapso deslogueaba al usuario de golpe aunque tuviera un
// refreshToken todavía válido. `refreshPromise` evita que varias peticiones
// que vencen al mismo tiempo disparen cada una su propio POST /auth/refresh —
// todas esperan la primera.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new Error('No hay refresh token');

  // axios directo, no apiClient — evita reentrar en este mismo interceptor si
  // el refresh también diera 401 (refreshToken vencido/inválido).
  const { data } = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh`, { refreshToken });
  useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const canRetry = error.response?.status === 401 && !originalRequest?._retry && useAuthStore.getState().refreshToken;

    if (canRetry) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
