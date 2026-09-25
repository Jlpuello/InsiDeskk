import axios from 'axios';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';

// withCredentials: la sesión viaja en cookies httpOnly, que el navegador solo
// adjunta si se lo pedimos (y solo hacia orígenes que el backend permite por CORS).
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
});

function readCsrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrf_token='))
    ?.slice('csrf_token='.length);
}

// Double-submit CSRF: el backend exige este header (igual a la cookie
// csrf_token) en todo request que modifica estado.
apiClient.interceptors.request.use((config) => {
  const csrf = readCsrfToken();
  if (csrf) config.headers['X-CSRF-Token'] = csrf;
  return config;
});

// El access token dura poco (1h, ver JWT_EXPIRES_IN en el backend) a
// propósito — la sesión larga vive en la cookie del refresh token. Sin esto,
// cualquier petición pasado ese lapso deslogueaba al usuario de golpe.
// `refreshPromise` evita que varias peticiones que vencen al mismo tiempo
// disparen cada una su propio POST /auth/refresh — todas esperan la primera.
let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  // axios directo, no apiClient — evita reentrar en este mismo interceptor si
  // el refresh también diera 401 (refresh token vencido/inválido).
  const csrf = readCsrfToken();
  await axios.post(
    `${apiClient.defaults.baseURL}/auth/refresh`,
    {},
    { withCredentials: true, headers: csrf ? { 'X-CSRF-Token': csrf } : {} },
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthCall = typeof originalRequest?.url === 'string' && originalRequest.url.startsWith('/auth/');
    const canRetry =
      error.response?.status === 401 && !originalRequest?._retry && !isAuthCall && useAuthStore.getState().user;

    if (canRetry) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshSession().finally(() => {
          refreshPromise = null;
        });
        await refreshPromise;
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !isAuthCall) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
