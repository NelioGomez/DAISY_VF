/**
 * Política de contraseña para la recuperación por correo. Es la misma que valida el
 * frontend (frontend/src/utils/passwordPolicy.ts): mantener ambas iguales.
 * Máximo 72: es el límite de bcrypt.
 */
export const RESET_PASSWORD_MIN = 10;
export const RESET_PASSWORD_MAX = 72;

export function passwordPolicyErrors(password: string, username = ''): string[] {
  const u = username.trim().toLowerCase();
  const errors: string[] = [];
  if (password.length < RESET_PASSWORD_MIN || password.length > RESET_PASSWORD_MAX) {
    errors.push(`Debe tener entre ${RESET_PASSWORD_MIN} y ${RESET_PASSWORD_MAX} caracteres`);
  }
  if (!/[a-zñ]/.test(password) || !/[A-ZÑ]/.test(password)) errors.push('Debe combinar mayúsculas y minúsculas');
  if (!/\d/.test(password)) errors.push('Debe incluir al menos un número');
  if (!/[^A-Za-z0-9ñÑ\s]/.test(password)) errors.push('Debe incluir al menos un símbolo');
  if (u && password.toLowerCase().includes(u)) errors.push('No debe contener su nombre de usuario');
  return errors;
}
