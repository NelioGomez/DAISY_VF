/** Convierte "true"/"false" de la query string en booleanos (para @Transform). */
export const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' || value === true
    ? true
    : value === 'false' || value === false
      ? false
      : value;