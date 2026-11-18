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

/** Acepta "AAAA-MM-DD" o una fecha ISO completa de la API. */
const toDate = (s: string): Date => new Date(s.length === 10 ? s + 'T00:00:00' : s);

export const fmtDate = (s: string | null | undefined): string =>
  s ? toDate(s).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (s: string | null | undefined): string =>
  s ? toDate(s).toLocaleString('es-NI', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Fecha local AAAA-MM-DD de un valor ISO (para agrupar por día). */
export const localDay = (s: string): string => {
  const d = toDate(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const nowStamp = (): string => new Date().toLocaleString('es-NI');

export const isOverdue = (date: string | null): boolean => !!date && new Date(date) < new Date();

/** Búsqueda en vivo: equivale a filtrar por el texto visible de la fila. */
export function matches(query: string, ...fields: Array<string | number | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.map((f) => String(f ?? '')).join(' ').toLowerCase().includes(q);
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Días completos transcurridos desde una fecha ISO. */
export const daysSince = (s: string | null | undefined): number =>
  s ? Math.max(0, Math.floor((Date.now() - toDate(s).getTime()) / 86_400_000)) : 0;

/** Antigüedad legible: "hoy", "ayer", "hace 8 días", "hace 2 meses". */
export function ago(s: string | null | undefined): string {
  if (!s) return '—';
  const d = daysSince(s);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 60) return `hace ${d} días`;
  return `hace ${Math.floor(d / 30)} meses`;
}

/** Fecha ISO de hoy + N días (vencimiento previsto de un crédito). */
export const isoInDays = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();
