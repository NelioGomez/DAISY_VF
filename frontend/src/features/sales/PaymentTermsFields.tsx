/* Condiciones de pago de una venta, con las reglas del backend:
   - Transferencia: referencia obligatoria.
   - Crédito: plazo en días (1–365) y abono inicial opcional. */
import { Field, InputField } from '../../components/forms/Field';
import type { TermsState } from './paymentTerms';
import type { MetodoPago } from '../../types';
import { money } from '../../utils/format';

const METODOS: MetodoPago[] = ['Contado', 'Transferencia', 'Crédito'];

export function PaymentTermsFields({ value, onChange, total }: { value: TermsState; onChange(v: TermsState): void; total: number }) {
  const set = <K extends keyof TermsState>(k: K, v: TermsState[K]) => onChange({ ...value, [k]: v });
  const credito = value.metodo === 'Crédito';
  const abono = Number(value.abono || 0);
  const showRef = value.metodo === 'Transferencia' || (credito && abono > 0 && value.metodoAbono === 'Transferencia');

  return (
    <div className="form-grid">
      <Field label="Forma de pago">
        <select value={value.metodo} onChange={(e) => set('metodo', e.target.value as MetodoPago)}>
          {METODOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      {credito && <InputField label="Plazo de crédito (días)" type="number" value={value.diasCredito} onChange={(v) => set('diasCredito', v)} />}
      {credito && (
        <InputField
          label="Abono inicial (C$)"
          type="number"
          value={value.abono}
          onChange={(v) => set('abono', v)}
          placeholder="0.00"
          help={total > 0 ? `Saldo a crédito: ${money(Math.max(0, total - abono))}` : undefined}
        />
      )}
      {credito && abono > 0 && (
        <Field label="Medio del abono">
          <select value={value.metodoAbono} onChange={(e) => set('metodoAbono', e.target.value as 'Contado' | 'Transferencia')}>
            <option>Contado</option>
            <option>Transferencia</option>
          </select>
        </Field>
      )}
      {showRef && <InputField label="Referencia de la transferencia" value={value.referencia} onChange={(v) => set('referencia', v)} placeholder="Ej: TRF-BANPRO-88213" />}
    </div>
  );
}
