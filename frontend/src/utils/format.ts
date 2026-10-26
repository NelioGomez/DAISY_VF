/* Utilidades de formato y fechas (migradas de los helpers del prototipo). */

export const money = (n?: number | null): string =>
  'C$ ' + (n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (n?: number | null): string => (n || 0).toLocaleString('es-NI');

export function daysAgo(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}

export const iso = (dt: Date): string => dt.toISOString().slice(0, 10);

export const todayISO = (): string => iso(new Date());

export const fmtDate = (s: string): string =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });

export const nowStamp = (): string => new Date().toLocaleString('es-NI');

export const isOverdue = (date: string | null): boolean => !!date && new Date(date) < new Date();

/** Búsqueda en vivo: equivale a filtrar por el texto visible de la fila. */
export function matches(query: string, ...fields: Array<string | number | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.map((f) => String(f ?? '')).join(' ').toLowerCase().includes(q);
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
