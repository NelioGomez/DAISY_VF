/**
 * Un JWT emitido antes del último cambio de contraseña ya no vale.
 * Se usa "iatMs" (milisegundos, lo agrega el login) para no dejar abierta una sesión iniciada
 * en el mismo segundo del cambio; los tokens sin ese dato se comparan por segundo ("iat").
 */
export function issuedBeforePasswordChange(
  iat: number | undefined,
  passwordChangedAt: Date | null | undefined,
  iatMs?: number,
): boolean {
  if (!passwordChangedAt) return false;
  if (typeof iatMs === 'number') return iatMs < passwordChangedAt.getTime();
  if (iat === undefined) return false;
  return iat < Math.floor(passwordChangedAt.getTime() / 1000);
}
