/* Política de contraseñas. El backend debe validar exactamente las mismas reglas. */
import { PASSWORD_MAX, PASSWORD_MIN } from '../config/security';

export interface PasswordRule {
  id: string;
  label: string;
  ok: boolean;
}

export function passwordRules(password: string, username = ''): PasswordRule[] {
  const u = username.trim().toLowerCase();
  return [
    { id: 'length', label: `Al menos ${PASSWORD_MIN} caracteres`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: 'case', label: 'Mayúsculas y minúsculas', ok: /[a-zñ]/.test(password) && /[A-ZÑ]/.test(password) },
    { id: 'number', label: 'Al menos un número', ok: /\d/.test(password) },
    { id: 'symbol', label: 'Al menos un símbolo (por ejemplo # $ ! ?)', ok: /[^A-Za-z0-9ñÑ\s]/.test(password) },
    { id: 'username', label: 'No contiene su nombre de usuario', ok: !u || !password.toLowerCase().includes(u) },
  ];
}

export const meetsPolicy = (password: string, username = '') => passwordRules(password, username).every((r) => r.ok);

export type Strength = 0 | 1 | 2 | 3 | 4;

/** Fuerza estimada de 0 (vacía) a 4 (excelente). */
export function passwordStrength(password: string, username = ''): Strength {
  if (!password) return 0;
  const passed = passwordRules(password, username).filter((r) => r.ok).length;
  let score = passed <= 2 ? 1 : passed <= 4 ? 2 : 3;
  if (score === 3 && password.length >= PASSWORD_MIN + 4) score = 4;
  return score as Strength;
}

export const STRENGTH_LABEL: Record<Strength, string> = {
  0: '',
  1: 'Débil',
  2: 'Aceptable',
  3: 'Buena',
  4: 'Excelente',
};
