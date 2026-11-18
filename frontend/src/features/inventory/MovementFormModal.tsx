import { useState } from 'react';
import { Field, InputField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { TipoMovimiento } from '../../types';

const PLACEHOLDER: Record<TipoMovimiento, string> = {
  Entrada: 'N° compra / proveedor',
  Salida: 'Venta / donación / consignación',
  Ajuste: 'Conteo físico / corrección',
};

export function MovementFormModal({ tipo }: { tipo: TipoMovimiento }) {
  const { db, registrarMovimiento } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [prodId, setProdId] = useState(db.productos[0]?.id ?? '');
  const [cant, setCant] = useState('');
  const [costo, setCosto] = useState('');
  const [ref, setRef] = useState('');

  const save = () => {
    const r = registrarMovimiento(tipo, prodId, +cant, tipo === 'Entrada' ? +costo || null : null, ref);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${tipo} registrada · stock ${r.data.sku}: ${r.data.stock}`, 'ok');
    close();
  };

  return (
    <Modal
      title={`Registrar ${tipo} de inventario`}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save}>
            Registrar {tipo}
          </button>
        </>
      }
    >
      <Field label="Producto">
        <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
          {db.productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku}) — stock {p.stock}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <InputField label="Cantidad" type="number" value={cant} onChange={setCant} />
        {tipo === 'Entrada' && (
          <InputField label="Costo unitario (C$)" type="number" value={costo} onChange={setCosto} help="Para recalcular costo promedio móvil" />
        )}
        <Field label="Referencia / motivo" full={tipo !== 'Entrada'}>
          <input value={ref} placeholder={PLACEHOLDER[tipo]} onChange={(e) => setRef(e.target.value)} />
        </Field>
      </div>
      {tipo === 'Entrada' && (
        <div className="note">
          <span className="ic">ℹ️</span>
          <div>
            El costo promedio se recalcula: <b>(stock×costo actual + cantidad×costo nuevo) ÷ stock total</b>.
          </div>
        </div>
      )}
    </Modal>
  );
}
