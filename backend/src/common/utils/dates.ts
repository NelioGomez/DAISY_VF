/** Nicaragua no usa horario de verano: UTC-6 fijo. */
const NI_OFFSET = '-06:00';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const isDateOnly = (v: string): boolean => DATE_ONLY.test(v);

/** "2026-03-15" → inicio o fin de ese día en hora de Nicaragua; otro ISO se respeta tal cual. */
export function parseBoundary(value: string, edge: 'start' | 'end'): Date {
  if (isDateOnly(value)) {
    return new Date(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}${NI_OFFSET}`);
  }
  return new Date(value);
}

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);

/** Rango opcional para filtros de fecha (from/to inclusivos). */
export function dateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from && { gte: parseBoundary(from, 'start') }),
    ...(to && { lte: parseBoundary(to, 'end') }),
  };
}