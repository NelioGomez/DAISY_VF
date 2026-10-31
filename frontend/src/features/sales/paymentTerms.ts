/* Condiciones de pago de una venta, con las reglas del backend:
   - Transferencia: referencia obligatoria.
   - Crédito: plazo en días (1–365) y abono inicial opcional. */
import type { CondicionesPago } from '../../store/storeContext';
import type { MetodoPago } from '../../types';

export interface TermsState {
  metodo: MetodoPago;
  referencia: string;
  diasCredito: string;
  abono: string;
  metodoAbono: 'Contado' | 'Transferencia';
  /** Contado: efectivo que entrega el cliente (solo para calcular el vuelto; no se envía). */
  recibido: string;
}

export const initialTerms = (): TermsState => ({ metodo: 'Contado', referencia: '', diasCredito: '15', abono: '', metodoAbono: 'Contado', recibido: '' });

export interface Efectivo {
  recibido: number;
  vuelto: number;
}

/** Efectivo recibido y vuelto de una venta de contado (null si no se indicó). */
export function efectivoDe(t: TermsState, total: number): Efectivo | null {
  if (t.metodo !== 'Contado' || t.recibido.trim() === '') return null;
  const recibido = Math.round(Number(t.recibido) * 100) / 100;
  if (!Number.isFinite(recibido)) return null;
  return { recibido, vuelto: Math.round((recibido - total) * 100) / 100 };
}

/** Valida y convierte al formato del store. Devuelve un mensaje si falta algo. */
export function buildTerms(t: TermsState, total: number): CondicionesPago | string {
  const needsRef = t.metodo === 'Transferencia' || (t.metodo === 'Crédito' && Number(t.abono) > 0 && t.metodoAbono === 'Transferencia');
  if (needsRef && !t.referencia.trim()) return 'Indique la referencia de la transferencia';
  const efectivo = efectivoDe(t, total);
  if (efectivo && efectivo.vuelto < 0) return `El efectivo recibido no cubre el total: faltan ${(-efectivo.vuelto).toFixed(2)}`;
  if (t.metodo === 'Crédito') {
    const dias = Math.round(Number(t.diasCredito));
    if (!(dias >= 1 && dias <= 365)) return 'El plazo de crédito debe estar entre 1 y 365 días';
    const abono = Number(t.abono || 0);
    if (abono < 0) return 'El abono no puede ser negativo';
    if (abono >= total && total > 0) return 'Si se paga todo, elija Contado o Transferencia';
    return { metodo: 'Crédito', diasCredito: dias, abonoInicial: abono || undefined, metodoAbono: t.metodoAbono, referencia: t.referencia };
  }
  return { metodo: t.metodo, referencia: t.referencia };
}
