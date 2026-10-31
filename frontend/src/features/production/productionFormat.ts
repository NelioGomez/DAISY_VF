/* Formatos propios de Producción. */

/** Tiempo de ciclo legible: "35 min", "6.5 h", "2.1 días". */
export function fmtHoras(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.max(0, Math.round(h * 60))} min`;
  if (h >= 48) return `${(h / 24).toLocaleString('es-NI', { maximumFractionDigits: 1 })} días`;
  return `${h.toLocaleString('es-NI', { maximumFractionDigits: 1 })} h`;
}

/** Minutos estándar → "1 h 20 min". */
export function fmtMinutos(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const pct = (v: number | null): string => (v === null ? '—' : `${v.toLocaleString('es-NI', { maximumFractionDigits: 1 })} %`);
