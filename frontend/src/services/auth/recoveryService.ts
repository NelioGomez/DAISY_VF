/* =====================================================================
   Recuperación de contraseña en 3 pasos.
   Primero se usa el backend (contrato en docs/recuperacion-contrasena.md):

     POST /api/v1/auth/forgot-password      { correo }
     POST /api/v1/auth/verify-reset-code    { correo, codigo }   → { resetToken }
     POST /api/v1/auth/reset-password       { resetToken, nuevaContrasena }

   Reglas de seguridad que se respetan aquí y debe aplicar el servidor:
   - La respuesta al pedir el código es igual exista o no el correo.
   - El código es de un solo uso, vence y admite pocos intentos.
   - Se limita cuántos códigos se piden por correo y cada cuánto se reenvía.
   - Validar el código entrega un permiso temporal; solo con él se cambia
     la contraseña.

   Si el servidor todavía no tiene esos endpoints (404) y la app corre en
   modo desarrollo, se usa una SIMULACIÓN local: el código aparece en
   pantalla y la contraseña real NO cambia. En producción se avisa que la
   recuperación no está disponible.
   ===================================================================== */
import { ApiError, api } from '../api/client';
import {
  RESET_CODE_LENGTH,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CODE_TTL_MINUTES,
  RESET_MAX_REQUESTS,
  RESET_RESEND_SECONDS,
  RESET_TOKEN_TTL_MINUTES,
  SHOW_DEMO_ACCOUNTS,
} from '../../config/security';
import { meetsPolicy } from '../../utils/passwordPolicy';
import { MOCK_USERS } from '../mock/users';

interface CodeEntry {
  code: string;
  username: string | null; // null = correo no registrado (señuelo)
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const codes = new Map<string, CodeEntry>();
const requests = new Map<string, number[]>();
const tokens = new Map<string, { username: string; expiresAt: number }>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => wait(500 + Math.random() * 300);

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** n••••••••n@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}•@${domain}`;
  return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 8))}${local[local.length - 1]}@${domain}`;
}

function randomDigits(n: number): string {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => String(x % 10)).join('');
}

function randomToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- Paso 1: pedir el código ---------- */

export type RequestResetResponse =
  | { ok: true; resendAfter: number; expiresIn: number; simulated?: boolean; devCode?: string; devNoAccount?: boolean }
  | { ok: false; code: 'INVALID_EMAIL' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'NETWORK'; message: string; retryAfter?: number };

async function simRequest(emailInput: string): Promise<RequestResetResponse> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) return { ok: false, code: 'INVALID_EMAIL', message: 'Escriba un correo válido, por ejemplo nombre@empresa.com.' };
  await latency();

  const now = Date.now();
  const prev = codes.get(email);
  if (prev && now - prev.lastSentAt < RESET_RESEND_SECONDS * 1000) {
    const retryAfter = Math.ceil((RESET_RESEND_SECONDS * 1000 - (now - prev.lastSentAt)) / 1000);
    return { ok: false, code: 'RATE_LIMITED', message: 'Espere un momento antes de pedir otro código.', retryAfter };
  }
  const recent = (requests.get(email) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= RESET_MAX_REQUESTS) {
    const retryAfter = Math.ceil((15 * 60_000 - (now - recent[0])) / 1000);
    return { ok: false, code: 'RATE_LIMITED', message: 'Se pidieron demasiados códigos para este correo. Intente más tarde.', retryAfter };
  }
  requests.set(email, [...recent, now]);

  const user = MOCK_USERS.find((u) => u.correo.toLowerCase() === email && u.activo);
  // Si el correo no existe se guarda un señuelo: el resto del flujo se comporta igual.
  const code = randomDigits(RESET_CODE_LENGTH);
  codes.set(email, { code, username: user?.username ?? null, expiresAt: now + RESET_CODE_TTL_MINUTES * 60_000, attempts: 0, lastSentAt: now });

  return {
    ok: true,
    resendAfter: RESET_RESEND_SECONDS,
    expiresIn: RESET_CODE_TTL_MINUTES * 60,
    simulated: true,
    ...(user ? { devCode: code } : { devNoAccount: true }),
  };
}

/* ---------- Paso 2: validar el código ---------- */

export type VerifyCodeResponse =
  | { ok: true; resetToken: string; username: string }
  | { ok: false; code: 'UNAVAILABLE'; message: string }
  | { ok: false; code: 'INVALID_CODE'; message: string; remainingAttempts: number }
  | { ok: false; code: 'EXPIRED' | 'TOO_MANY_ATTEMPTS'; message: string };

async function simVerify(emailInput: string, codeInput: string): Promise<VerifyCodeResponse> {
  const email = normalizeEmail(emailInput);
  await latency();
  const entry = codes.get(email);
  const now = Date.now();

  if (!entry || entry.expiresAt < now) {
    codes.delete(email);
    return { ok: false, code: 'EXPIRED', message: 'El código venció. Pida uno nuevo.' };
  }
  if (entry.code !== codeInput || !entry.username) {
    entry.attempts += 1;
    if (entry.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      codes.delete(email);
      return { ok: false, code: 'TOO_MANY_ATTEMPTS', message: 'Se agotaron los intentos para este código. Pida uno nuevo.' };
    }
    return { ok: false, code: 'INVALID_CODE', message: 'El código no coincide.', remainingAttempts: RESET_CODE_MAX_ATTEMPTS - entry.attempts };
  }

  codes.delete(email); // un solo uso
  const resetToken = randomToken();
  tokens.set(resetToken, { username: entry.username, expiresAt: now + RESET_TOKEN_TTL_MINUTES * 60_000 });
  return { ok: true, resetToken, username: entry.username };
}

/* ---------- Paso 3: fijar la nueva contraseña ---------- */

export type ResetPasswordResponse =
  | { ok: true; username: string; simulated?: boolean }
  | { ok: false; code: 'TOKEN_EXPIRED' | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'UNAVAILABLE'; message: string };

async function simReset(resetToken: string, newPassword: string): Promise<ResetPasswordResponse> {
  await latency();
  const t = tokens.get(resetToken);
  if (!t || t.expiresAt < Date.now()) {
    tokens.delete(resetToken);
    return { ok: false, code: 'TOKEN_EXPIRED', message: 'El tiempo para cambiar la contraseña terminó. Empiece de nuevo.' };
  }
  const user = MOCK_USERS.find((u) => u.username === t.username);
  if (!user) return { ok: false, code: 'TOKEN_EXPIRED', message: 'El tiempo para cambiar la contraseña terminó. Empiece de nuevo.' };
  if (!meetsPolicy(newPassword, user.username)) {
    return { ok: false, code: 'WEAK_PASSWORD', message: 'La contraseña no cumple los requisitos.' };
  }
  if (newPassword === user.password) {
    return { ok: false, code: 'SAME_PASSWORD', message: 'Use una contraseña distinta de la anterior.' };
  }
  user.password = newPassword;
  tokens.delete(resetToken);
  return { ok: true, username: user.username, simulated: true };
}

/* ---------- Capa pública: servidor primero, simulación como respaldo ---------- */

type Mode = 'unknown' | 'api' | 'sim';
let mode: Mode = 'unknown';

const UNAVAILABLE = 'La recuperación por correo todavía no está habilitada. Pida al administrador que restablezca su contraseña.';
const NETWORK = 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.';

const notImplemented = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);
const secondsFrom = (e: ApiError): number | undefined => {
  const v = Number(e.headers?.get('Retry-After') ?? e.headers?.get('X-RateLimit-Reset'));
  return Number.isFinite(v) && v > 0 ? Math.ceil(v) : undefined;
};
/** El servidor puede informar los intentos restantes como error del campo "remainingAttempts". */
const remainingFrom = (e: ApiError): number => {
  const n = Number(e.errors.find((x) => x.field === 'remainingAttempts')?.message);
  return Number.isFinite(n) ? n : 1;
};

/** Paso 1. */
export async function requestPasswordReset(emailInput: string): Promise<RequestResetResponse> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) return { ok: false, code: 'INVALID_EMAIL', message: 'Escriba un correo válido, por ejemplo nombre@empresa.com.' };
  if (mode === 'sim') return simRequest(email);
  try {
    const r = await api.post<{ resendAfter?: number; expiresIn?: number } | null>('/auth/forgot-password', { correo: email }, false);
    mode = 'api';
    return { ok: true, resendAfter: r?.resendAfter ?? RESET_RESEND_SECONDS, expiresIn: r?.expiresIn ?? RESET_CODE_TTL_MINUTES * 60 };
  } catch (e) {
    if (notImplemented(e)) {
      if (!SHOW_DEMO_ACCOUNTS) return { ok: false, code: 'UNAVAILABLE', message: UNAVAILABLE };
      mode = 'sim';
      return simRequest(email);
    }
    if (e instanceof ApiError && e.status === 429)
      return { ok: false, code: 'RATE_LIMITED', message: 'Se pidieron demasiados códigos. Intente más tarde.', retryAfter: secondsFrom(e) };
    if (e instanceof ApiError && e.status === 422) return { ok: false, code: 'INVALID_EMAIL', message: e.userMessage };
    return { ok: false, code: 'NETWORK', message: e instanceof ApiError && e.status !== 0 ? e.userMessage : NETWORK };
  }
}

/** Paso 2. */
export async function verifyResetCode(emailInput: string, codeInput: string): Promise<VerifyCodeResponse> {
  if (mode === 'sim') return simVerify(emailInput, codeInput);
  try {
    const r = await api.post<{ resetToken: string; username: string }>('/auth/verify-reset-code', { correo: normalizeEmail(emailInput), codigo: codeInput }, false);
    return { ok: true, resetToken: r.resetToken, username: r.username };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 0) return { ok: false, code: 'UNAVAILABLE', message: NETWORK };
    if (e.status === 410) return { ok: false, code: 'EXPIRED', message: e.userMessage || 'El código venció. Pida uno nuevo.' };
    if (e.status === 429) return { ok: false, code: 'TOO_MANY_ATTEMPTS', message: 'Se agotaron los intentos para este código. Pida uno nuevo.' };
    if (e.status === 400 || e.status === 422) {
      const left = remainingFrom(e);
      if (left <= 0) return { ok: false, code: 'TOO_MANY_ATTEMPTS', message: 'Se agotaron los intentos para este código. Pida uno nuevo.' };
      return { ok: false, code: 'INVALID_CODE', message: 'El código no coincide.', remainingAttempts: left };
    }
    return { ok: false, code: 'UNAVAILABLE', message: e.userMessage };
  }
}

/** Paso 3. */
export async function resetPassword(resetToken: string, newPassword: string): Promise<ResetPasswordResponse> {
  if (mode === 'sim') return simReset(resetToken, newPassword);
  try {
    const r = await api.post<{ username: string }>('/auth/reset-password', { resetToken, nuevaContrasena: newPassword }, false);
    return { ok: true, username: r.username };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 0) return { ok: false, code: 'UNAVAILABLE', message: NETWORK };
    if (e.status === 401 || e.status === 410) return { ok: false, code: 'TOKEN_EXPIRED', message: 'El tiempo para cambiar la contraseña terminó. Empiece de nuevo.' };
    if (e.status === 409) return { ok: false, code: 'SAME_PASSWORD', message: 'Use una contraseña distinta de la anterior.' };
    if (e.status === 400 || e.status === 422) return { ok: false, code: 'WEAK_PASSWORD', message: e.userMessage };
    return { ok: false, code: 'UNAVAILABLE', message: e.userMessage };
  }
}
