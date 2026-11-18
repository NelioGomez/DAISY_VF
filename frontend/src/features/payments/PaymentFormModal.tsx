/* Abono a una factura. La API acepta efectivo o transferencia (con referencia). */
import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CuentaPorCobrar } from '../../types';
import { money } from '../../utils/format';

export function PaymentFormModal({ cuenta }: { cuenta: CuentaPorCobrar }) {
  const { registrarPago } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [monto, setMonto] = useState(String(cuenta.saldo));
  const [metodo, setMetodo] = useState<'Contado' | 'Transferencia'>('Transferencia');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const m = Math.round(Number(monto) * 100) / 100;
    if (!(m > 0)) return toast('El monto debe ser mayor que cero', 'err');
    if (m > cuenta.saldo) return toast(`El monto no puede superar el saldo (${money(cuenta.saldo)})`, 'err');
    if (metodo === 'Transferencia' && !ref.trim()) return toast('Indique la referencia de la transferencia', 'err');
    setSaving(true);
    const r = await registrarPago(cuenta.venta, m, metodo, ref);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    const restante = Math.max(0, Math.round((cuenta.saldo - m) * 100) / 100);
    toast(restante > 0 ? `Pago registrado · saldo: ${money(restante)}` : `Factura ${cuenta.factura} pagada por completo`, 'ok');
    close();
  };

  return (
    <Modal
      title={'Registrar pago — ' + cuenta.factura}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar abono'}
          </button>
        </>
      }
    >
      <div className="card" style={{ background: 'var(--panel)', marginBottom: 14 }}>
        <b>{cuenta.cliN}</b>
        <div className="totbox" style={{ width: '100%', margin: '8px 0 0' }}>
          <div className="r">
            <span>Total factura</span>
            <span>{money(cuenta.total)}</span>
          </div>
          <div className="r" style={{ color: 'var(--red)' }}>
            <span>Saldo actual</span>
            <span>{money(cuenta.saldo)}</span>
          </div>
        </div>
      </div>
      <div className="form-grid">
        <InputField label="Monto a abonar (C$)" type="number" value={monto} onChange={setMonto} help={'Máximo: ' + money(cuenta.saldo)} />
        <Field label="Medio de pago">
          <select value={metodo} onChange={(e) => setMetodo(e.target.value as 'Contado' | 'Transferencia')}>
            <option>Transferencia</option>
            <option>Contado</option>
          </select>
        </Field>
        {metodo === 'Transferencia' && <InputField label="Referencia de la transferencia" value={ref} onChange={setRef} placeholder="Ej: TRF-BANPRO-88213" full />}
      </div>
    </Modal>
  );
}
