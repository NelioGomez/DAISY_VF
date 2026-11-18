/* Condiciones de pago de una venta, con las reglas del backend:
   - Transferencia: referencia obligatoria.
   - Crédito: plazo en días (1–365) y abono inicial opcional.
   La forma de pago se elige con tarjetas (mejora n.° 25): ícono + texto, navegables con teclado. */
import { Field, InputField } from '../../components/forms/Field';
import type { TermsState } from './paymentTerms';
import type { MetodoPago } from '../../types';
import { fmtDate, isoInDays, money } from '../../utils/format';

const METODOS: Array<{ id: MetodoPago; ic: string; desc: string }> = [
  { id: 'Contado', ic: '💵', desc: 'Efectivo, se cobra todo ahora' },
  { id: 'Transferencia', ic: '🏦', desc: 'Pago completo con referencia' },
  { id: 'Crédito', ic: '🗓', desc: 'Queda saldo por cobrar' },
];

export function PaymentTermsFields({ value, onChange, total }: { value: TermsState; onChange(v: TermsState): void; total: number }) {
  const set = <K extends keyof TermsState>(k: K, v: TermsState[K]) => onChange({ ...value, [k]: v });
  const credito = value.metodo === 'Crédito';
  const abono = Number(value.abono || 0);
  const showRef = value.metodo === 'Transferencia' || (credito && abono > 0 && value.metodoAbono === 'Transferencia');
  const dias = Math.round(Number(value.diasCredito));
  const vence = credito && dias >= 1 && dias <= 365 ? isoInDays(dias) : null;

  return (
    <>
      <div className="pay-cards" role="radiogroup" aria-label="Forma de pago">
        {METODOS.map((m) => (
          <label key={m.id} className={`pay-card ${value.metodo === m.id ? 'active' : ''}`}>
            <input type="radio" name="metodo-pago" value={m.id} checked={value.metodo === m.id} onChange={() => set('metodo', m.id)} />
            <span className="pay-ic" aria-hidden="true">
              {m.ic}
            </span>
            <b>{m.id}</b>
            <small>{m.desc}</small>
          </label>
        ))}
      </div>
      {(credito || showRef) && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          {credito && (
            <InputField
              label="Plazo de crédito (días)"
              type="number"
              value={value.diasCredito}
              onChange={(v) => set('diasCredito', v)}
              help={vence ? `Vence el ${fmtDate(vence)}` : 'Entre 1 y 365 días'}
            />
          )}
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
          {showRef && (
            <InputField label="Referencia de la transferencia" value={value.referencia} onChange={(v) => set('referencia', v)} placeholder="Ej: TRF-BANPRO-88213" />
          )}
        </div>
      )}
    </>
  );
}
