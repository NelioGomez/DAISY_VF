export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Texto opcional: cadena vacía → null (permite borrar el dato con PATCH). */
export const emptyToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export const emptyToNullUpper = ({ value }: { value: unknown }): unknown => {
  const v = emptyToNull({ value });
  return typeof v === 'string' ? v.toUpperCase() : v;
};

export const emptyToNullLower = ({ value }: { value: unknown }): unknown => {
  const v = emptyToNull({ value });
  return typeof v === 'string' ? v.toLowerCase() : v;
};