import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = 'https://optichat.optishieldx.com/api';
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
  }
}

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) return false;
    try {
      const response = await fetch(getApiUrl('/auth/refresh-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      useAuthStore.getState().updateTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}, retried = false) {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(getApiUrl(endpoint), { ...options, headers });
  if (response.status === 401 && !retried && await refreshSession()) {
    return fetchApi(endpoint, options, true);
  }
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError('Sesión expirada', 401);
  }
  return response;
}

export async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchApi(endpoint, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((body as any)?.error || `Error HTTP ${response.status}`, response.status, body);
  }
  return body as T;
}
