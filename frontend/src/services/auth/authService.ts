/* =====================================================================
   Autenticación contra la API NestJS.
     POST /api/v1/auth/login   { username, password } → { accessToken, expiresIn, user }
     GET  /api/v1/auth/me      → usuario con rol y permisos
     POST /api/v1/auth/logout  → solo auditoría (el JWT no tiene estado)

   El servidor ya aplica: bcrypt, mensaje genérico, 5 intentos por minuto
   por IP (HTTP 429) y bloqueo de usuarios inactivos (HTTP 403).
   ===================================================================== */
import { ROLES } from '../../config/navigation';
import type { SessionUser } from '../../types';
import { ApiError, api } from '../api/client';
import { ROLE_FROM_API, type ApiRole } from '../api/mappers';

export type LoginFailure =
  | { ok: false; code: 'INVALID_CREDENTIALS'; message: string; remainingAttempts: number | null }
  | { ok: false; code: 'LOCKED'; message: string; retryAfter: number }
  | { ok: false; code: 'INACTIVE' | 'NETWORK' | 'UNKNOWN'; message: string };

export type LoginResponse = { ok: true; user: SessionUser; token: string; expiresAt: number } | LoginFailure;

interface ApiUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
  permissions: string[];
}

export function toSessionUser(u: ApiUser): SessionUser {
  const role = ROLE_FROM_API[u.role] ?? 'tecnico';
  const r = ROLES[role];
  return {
    id: u.id,
    role,
    user: u.username,
    name: r.name,
    fullName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
    email: u.email,
    color: r.color,
    permissions: u.permissions ?? [],
  };
}

/** Usuario o correo: el servidor guarda ambos en minúsculas. */
export const normalizeUsername = (u: string) => u.trim().toLowerCase();

const header = (h: Headers | undefined, name: string) => h?.get(name) ?? h?.get(`${name}-default`) ?? null;

export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    const res = await api.post<{ accessToken: string; expiresIn: number; user: ApiUser }>(
      '/auth/login',
      { username: normalizeUsername(username), password },
      false,
    );
    return { ok: true, user: toSessionUser(res.user), token: res.accessToken, expiresAt: Date.now() + res.expiresIn * 1000 };
  } catch (e) {
    if (!(e instanceof ApiError)) return { ok: false, code: 'UNKNOWN', message: 'Ocurrió un error inesperado.' };
    if (e.status === 0) return { ok: false, code: 'NETWORK', message: e.message };
    if (e.status === 429) {
      const retry = Number(header(e.headers, 'Retry-After') ?? header(e.headers, 'X-RateLimit-Reset') ?? 60);
      return { ok: false, code: 'LOCKED', message: 'Demasiados intentos fallidos.', retryAfter: Number.isFinite(retry) && retry > 0 ? retry : 60 };
    }
    if (e.status === 403) return { ok: false, code: 'INACTIVE', message: 'Su usuario está desactivado. Comuníquese con el administrador.' };
    if (e.status === 401 || e.status === 422) {
      const remaining = header(e.headers, 'X-RateLimit-Remaining');
      return {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Usuario o contraseña incorrectos.',
        remainingAttempts: remaining !== null && remaining !== '' ? Number(remaining) : null,
      };
    }
    return { ok: false, code: 'UNKNOWN', message: e.userMessage };
  }
}

export async function me(): Promise<SessionUser> {
  return toSessionUser(await api.get<ApiUser>('/auth/me'));
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    /* si el token ya venció, basta con descartarlo en el cliente */
  }
}
