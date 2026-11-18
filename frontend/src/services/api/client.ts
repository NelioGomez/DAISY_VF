/* =====================================================================
   Cliente HTTP para la API REST de NestJS (/api/v1).
   - Adjunta el JWT en Authorization: Bearer.
   - Desenvuelve { success, data, pagination, summary }.
   - Convierte errores en ApiError con mensaje legible.
   - Avisa a la sesión cuando el token vence (401) para cerrarla.
   En desarrollo, Vite redirige /api a http://localhost:3000 (vite.config.ts).
   ===================================================================== */

const API_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  pagination?: Pagination;
  summary?: Record<string, unknown>;
  headers: Headers;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Array<{ field?: string; message: string }>;
  readonly headers?: Headers;

  constructor(status: number, message: string, errors: Array<{ field?: string; message: string }> = [], headers?: Headers) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.headers = headers;
  }

  /** Mensaje para mostrar: incluye los errores por campo cuando existen. */
  get userMessage(): string {
    if (!this.errors.length) return this.message;
    const details = this.errors.map((e) => e.message).filter(Boolean);
    return details.length ? details.join(' · ') : this.message;
  }
}

/* ---------- Token de sesión ---------- */

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** La sesión registra aquí qué hacer si el servidor responde 401 a una petición autenticada. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/* ---------- Petición base ---------- */

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return `${API_URL}${path}${s ? `?${s}` : ''}`;
}

export async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query; auth?: boolean } = {}): Promise<ApiEnvelope<T>> {
  const useAuth = opts.auth !== false;
  const headers = new Headers({ Accept: 'application/json' });
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
  if (useAuth && authToken) headers.set('Authorization', `Bearer ${authToken}`);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Verifique que el backend esté encendido.');
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: T; message?: string; errors?: Array<{ field?: string; message: string }>; pagination?: Pagination; summary?: Record<string, unknown> }
    | null;

  if (!res.ok) {
    if (res.status === 401 && useAuth && authToken) onUnauthorized?.();
    const fallback =
      res.status === 403
        ? 'No tiene permiso para realizar esta acción.'
        : res.status === 404
          ? 'El recurso solicitado no existe.'
          : res.status === 429
            ? 'Demasiadas solicitudes. Espere un momento.'
            : res.status >= 500
              ? 'Error interno del servidor. Intente de nuevo.'
              : `Error ${res.status}`;
    throw new ApiError(res.status, json?.message || fallback, json?.errors ?? [], res.headers);
  }

  return { data: (json?.data ?? null) as T, pagination: json?.pagination, summary: json?.summary, headers: res.headers };
}

export const api = {
  get: <T>(path: string, query?: Query, auth = true) => request<T>('GET', path, { query, auth }).then((r) => r.data),
  getPage: <T>(path: string, query?: Query, auth = true) => request<T>('GET', path, { query, auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>('POST', path, { body: body ?? {}, auth }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }).then((r) => r.data),
  del: <T>(path: string) => request<T>('DELETE', path).then((r) => r.data),
};

/**
 * Trae todas las páginas de un listado (la API devuelve máximo 100 por página).
 * `maxPages` evita cargas enormes en colecciones que crecen sin límite.
 */
export async function getAll<T>(path: string, query: Query = {}, maxPages = 20, auth = true): Promise<{ items: T[]; summary?: Record<string, unknown> }> {
  const items: T[] = [];
  let page = 1;
  let summary: Record<string, unknown> | undefined;
  for (;;) {
    const res = await request<T[]>('GET', path, { query: { limit: 100, ...query, page }, auth });
    items.push(...(res.data ?? []));
    summary ??= res.summary;
    const totalPages = res.pagination?.totalPages ?? 1;
    if (page >= totalPages || page >= maxPages) break;
    page += 1;
  }
  return { items, summary };
}

/** Convierte cualquier error en un texto para el usuario. */
export const errorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.userMessage : e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
