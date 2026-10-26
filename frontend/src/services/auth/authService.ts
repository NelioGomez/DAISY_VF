/* =====================================================================
   Servicio de autenticación.
   Hoy simula al backend en memoria; su firma está pensada para que
   reemplazarlo por `api.post('/auth/login', ...)` no cambie la pantalla.

   Comportamiento que el backend NestJS debe replicar:
   - Mensaje genérico ante usuario o contraseña incorrectos (no revela cuál falló
     ni si la cuenta existe).
   - Conteo de intentos fallidos por usuario y bloqueo temporal (HTTP 429).
   - Las cuentas inactivas responden igual que una credencial incorrecta.
   ===================================================================== */
import { LOCKOUT_SECONDS, MAX_LOGIN_ATTEMPTS } from '../../config/security';
import type { RoleKey } from '../../types';
import { MOCK_USERS } from '../mock/users';

export type LoginFailure =
  | { ok: false; code: 'INVALID_CREDENTIALS'; message: string; remainingAttempts: number }
  | { ok: false; code: 'LOCKED'; message: string; retryAfter: number };

export type LoginResponse = { ok: true; username: string; role: RoleKey } | LoginFailure;

interface ThrottleEntry {
  fails: number;
  lockedUntil: number;
}

/** Estado de intentos por usuario (en el backend vivirá en BD o Redis). */
const throttle = new Map<string, ThrottleEntry>();

const GENERIC_ERROR = 'Usuario o contraseña incorrectos.';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Comparación en tiempo constante para no filtrar información por la duración. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export async function login(usernameInput: string, password: string): Promise<LoginResponse> {
  const username = normalizeUsername(usernameInput);
  // Latencia simulada de red: también evita respuestas instantáneas que faciliten la fuerza bruta.
  await wait(550 + Math.random() * 250);

  const now = Date.now();
  const entry = throttle.get(username) ?? { fails: 0, lockedUntil: 0 };

  if (entry.lockedUntil > now) {
    return {
      ok: false,
      code: 'LOCKED',
      message: 'Demasiados intentos fallidos.',
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  const user = MOCK_USERS.find((u) => u.username === username);
  const valid = !!user && user.activo && safeEqual(user.password, password);

  if (valid && user) {
    throttle.delete(username);
    return { ok: true, username: user.username, role: user.role };
  }

  // El contador aplica exista o no la cuenta, para no revelar qué usuarios son válidos.
  entry.fails += 1;
  if (entry.fails >= MAX_LOGIN_ATTEMPTS) {
    entry.fails = 0;
    entry.lockedUntil = now + LOCKOUT_SECONDS * 1000;
    throttle.set(username, entry);
    return {
      ok: false,
      code: 'LOCKED',
      message: 'Demasiados intentos fallidos.',
      retryAfter: LOCKOUT_SECONDS,
    };
  }
  throttle.set(username, entry);
  return { ok: false, code: 'INVALID_CREDENTIALS', message: GENERIC_ERROR, remainingAttempts: MAX_LOGIN_ATTEMPTS - entry.fails };
}
