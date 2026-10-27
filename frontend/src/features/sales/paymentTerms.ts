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
}

export const initialTerms = (): TermsState => ({ metodo: 'Contado', referencia: '', diasCredito: '15', abono: '', metodoAbono: 'Contado' });

/** Valida y convierte al formato del store. Devuelve un mensaje si falta algo. */
export function buildTerms(t: TermsState, total: number): CondicionesPago | string {
  const needsRef = t.metodo === 'Transferencia' || (t.metodo === 'Crédito' && Number(t.abono) > 0 && t.metodoAbono === 'Transferencia');
  if (needsRef && !t.referencia.trim()) return 'Indique la referencia de la transferencia';
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
