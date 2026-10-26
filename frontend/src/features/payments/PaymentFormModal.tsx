import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { MetodoPago } from '../../types';
import { money } from '../../utils/format';

const METODOS: MetodoPago[] = ['Transferencia', 'Contado', 'Crédito'];

export function PaymentFormModal({ ventaId }: { ventaId: string }) {
  const { db, registrarPago } = useData();
  const toast = useToast();
  const { close } = useModal();
  const v = db.ventas.find((x) => x.id === ventaId);
  const [monto, setMonto] = useState(String(v?.saldo ?? ''));
  const [metodo, setMetodo] = useState<MetodoPago>('Transferencia');
  if (!v) return null;

  const save = () => {
    const r = registrarPago(ventaId, +monto, metodo);
    if (!r.ok) return toast(r.error, 'err');
    toast('Pago registrado · saldo: ' + money(r.data), 'ok');
    close();
  };

  return (
    <Modal
      title={'Registrar pago — ' + v.factura}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save}>
            Registrar abono
          </button>
        </>
      }
    >
      <div className="card" style={{ background: 'var(--panel)', marginBottom: 14 }}>
        <b>{v.cliN}</b>
        <div className="totbox" style={{ width: '100%', margin: '8px 0 0' }}>
          <div className="r">
            <span>Total factura</span>
            <span>{money(v.total)}</span>
          </div>
          <div className="r" style={{ color: 'var(--red)' }}>
            <span>Saldo actual</span>
            <span>{money(v.saldo)}</span>
          </div>
        </div>
      </div>
      <div className="form-grid">
        <InputField label="Monto a abonar (C$)" type="number" value={monto} onChange={setMonto} help={'Máx: ' + money(v.saldo)} />
        <Field label="Método">
          <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
            {METODOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
