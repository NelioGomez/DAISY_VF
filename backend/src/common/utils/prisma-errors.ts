function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

/** P2002 = violación de restricción UNIQUE en Prisma. */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002');
}

/** P2003 = violación de clave foránea (ej. borrar algo que está referenciado). */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, 'P2003');
}