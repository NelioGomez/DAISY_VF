import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useData } from '../../store/hooks';
import type { Compra } from '../../types';
import { useRecords } from '../records/records';

export function CancelPurchaseModal({ compra }: { compra: Compra }) {
  const { cancelarCompra } = useData();
  const toast = useToast();
  const { openRecord } = useRecords();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const parcial = compra.estado === 'Parcial';
  const back = () => openRecord('compra', compra.id);

  const confirmar = async () => {
    if (motivo.trim().length < 5) return toast('Indique el motivo (mínimo 5 caracteres)', 'err');
    setSaving(true);
    const r = await cancelarCompra(compra.id, motivo.trim());
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${compra.codigo} cancelada`, 'ok');
    back();
  };

  return (
    <Modal
      title={parcial ? `Cancelar lo pendiente · ${compra.codigo}` : `Cancelar compra ${compra.codigo}`}
      footer={
        <>
          <button className="b b-out" onClick={back}>
            Volver
          </button>
          <button className="b b-red" onClick={confirmar} disabled={saving}>
            {saving ? 'Cancelando…' : 'Cancelar compra'}
          </button>
        </>
      }
    >
      <div className="note" style={{ marginBottom: 12 }}>
        <span className="ic">ℹ️</span>
        <div>
          {parcial
            ? `Ya se recibieron ${compra.recibidas} de ${compra.unidades} unidades: eso se conserva en inventario. Se cancela solo lo que falta.`
            : 'La compra no ha movido inventario. Quedará como cancelada (no se borra) para conservar el historial.'}
        </div>
      </div>
      <Field label="Motivo" htmlFor="cancel-motivo" full>
        <textarea id="cancel-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ej: el proveedor no tiene existencias" />
      </Field>
    </Modal>
  );
}
