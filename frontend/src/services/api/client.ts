/* =====================================================================
   Cliente HTTP para la API REST de NestJS.
   Aún no se usa: los módulos trabajan con la capa simulada (store/).
   Al migrar un módulo, sus llamadas deben pasar por aquí, nunca con
   fetch disperso dentro de los componentes.
   ===================================================================== */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const message = (body && typeof body === 'object' && 'message' in body && String(body.message)) || res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, data?: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) => apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
