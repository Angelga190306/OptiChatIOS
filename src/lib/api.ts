import { useAuthStore } from "../store/useAuthStore";

export function getApiUrl(path: string): string {
  const baseUrl = 'https://optichat.optishieldx.com/api';
  return `${baseUrl}${path}`;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().accessToken;
  
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(getApiUrl(endpoint), {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized (Session expired)
  if (response.status === 401) {
    // For now, simply logout if token is expired/invalid
    // (A more advanced implementation would try to use /refresh-token here)
    useAuthStore.getState().logout();
    throw new Error("Sesión expirada");
  }

  return response;
}

