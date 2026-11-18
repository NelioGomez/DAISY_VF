/* =====================================================================
   Recuperación de contraseña en 3 pasos.
   La hace el backend (contrato en docs/recuperacion-contrasena.md):

     POST /api/v1/auth/forgot-password      { email }            → { resendAfter, expiresIn }
     POST /api/v1/auth/verify-reset-code    { email, code }      → { resetToken, username }
     POST /api/v1/auth/reset-password       { resetToken, newPassword } → { username }

   Las reglas de seguridad las aplica el servidor: la respuesta al pedir el código es igual
   exista o no el correo; el código es de un solo uso, vence y admite pocos intentos; se limita
   cuántos códigos se piden y cada cuánto se reenvía; validar el código entrega un permiso
   temporal y solo con él se cambia la contraseña. Sin correo configurado (SMTP), en desarrollo
   el servidor muestra el código en su terminal.
   ===================================================================== */
import { ApiError, api } from '../api/client';
import { RESET_CODE_TTL_MINUTES, RESET_RESEND_SECONDS } from '../../config/security';

const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** n••••••••n@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}•@${domain}`;
  return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 8))}${local[local.length - 1]}@${domain}`;
}

export type RequestResetResponse =
  | { ok: true; resendAfter: number; expiresIn: number }
  | { ok: false; code: 'INVALID_EMAIL' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'NETWORK'; message: string; retryAfter?: number };

export type VerifyCodeResponse =
  | { ok: true; resetToken: string; username: string }
  | { ok: false; code: 'UNAVAILABLE'; message: string }
  | { ok: false; code: 'INVALID_CODE'; message: string; remainingAttempts: number }
  | { ok: false; code: 'EXPIRED' | 'TOO_MANY_ATTEMPTS'; message: string };

export type ResetPasswordResponse =
  | { ok: true; username: string }
  | { ok: false; code: 'TOKEN_EXPIRED' | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'UNAVAILABLE'; message: string };

const UNAVAILABLE = 'La recuperación por correo no está disponible. Pida al administrador que restablezca su contraseña.';
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
  try {
    const r = await api.post<{ resendAfter?: number; expiresIn?: number } | null>('/auth/forgot-password', { email }, false);
    return { ok: true, resendAfter: r?.resendAfter ?? RESET_RESEND_SECONDS, expiresIn: r?.expiresIn ?? RESET_CODE_TTL_MINUTES * 60 };
  } catch (e) {
    if (notImplemented(e)) return { ok: false, code: 'UNAVAILABLE', message: UNAVAILABLE };
    if (e instanceof ApiError && e.status === 429)
      return { ok: false, code: 'RATE_LIMITED', message: 'Se pidieron demasiados códigos. Intente más tarde.', retryAfter: secondsFrom(e) };
    if (e instanceof ApiError && e.status === 422) return { ok: false, code: 'INVALID_EMAIL', message: e.userMessage };
    return { ok: false, code: 'NETWORK', message: e instanceof ApiError && e.status !== 0 ? e.userMessage : NETWORK };
  }
}

/** Paso 2. */
export async function verifyResetCode(emailInput: string, codeInput: string): Promise<VerifyCodeResponse> {
  try {
    const r = await api.post<{ resetToken: string; username: string }>('/auth/verify-reset-code', { email: normalizeEmail(emailInput), code: codeInput }, false);
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
  try {
    const r = await api.post<{ username: string }>('/auth/reset-password', { resetToken, newPassword }, false);
    return { ok: true, username: r.username };
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 0) return { ok: false, code: 'UNAVAILABLE', message: NETWORK };
    if (e.status === 401 || e.status === 410) return { ok: false, code: 'TOKEN_EXPIRED', message: 'El tiempo para cambiar la contraseña terminó. Empiece de nuevo.' };
    if (e.status === 409) return { ok: false, code: 'SAME_PASSWORD', message: 'Use una contraseña distinta de la anterior.' };
    if (e.status === 400 || e.status === 422) return { ok: false, code: 'WEAK_PASSWORD', message: e.userMessage };
    return { ok: false, code: 'UNAVAILABLE', message: e.userMessage };
  }
}
