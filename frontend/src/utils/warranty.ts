/* Garantías (mejora n.° 60): plazo del producto en palabras y vigencia de una cobertura. */
import { fmtDate } from './format';

const DAY = 86_400_000;

/** 365 → "1 año", 180 → "6 meses", 90 → "3 meses", 45 → "45 días". */
export function plazoGarantia(dias: number): string {
  if (dias >= 365 && dias % 365 === 0) return dias === 365 ? '1 año' : `${dias / 365} años`;
  if (dias >= 30 && dias % 30 === 0) return dias === 30 ? '1 mes' : `${dias / 30} meses`;
  return dias === 1 ? '1 día' : `${dias} días`;
}

/** Días completos que faltan para el vencimiento (negativo si ya venció). */
export const diasHasta = (hasta: string): number => Math.floor((new Date(hasta).getTime() - Date.now()) / DAY);

export const vigente = (hasta: string | null | undefined): boolean => !!hasta && new Date(hasta).getTime() >= Date.now();

/** "vigente hasta 12/03/2027 · quedan 40 días" o "venció el 12/03/2027". */
export function vigenciaTexto(hasta: string | null | undefined): string {
  if (!hasta) return 'sin fecha de vencimiento';
  if (!vigente(hasta)) return `venció el ${fmtDate(hasta)}`;
  const d = diasHasta(hasta);
  return `vigente hasta ${fmtDate(hasta)} · ${d < 1 ? 'vence hoy' : d === 1 ? 'queda 1 día' : `quedan ${d} días`}`;
}
