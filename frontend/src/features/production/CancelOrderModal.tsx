/* Cancelar una orden que todavía no consumió materiales (Borrador o Liberada). */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import { OrderDetailModal } from './OrderDetailModal';
import { produccionApi, type OrdenProduccion } from './productionApi';

export function CancelOrderModal({ orden }: { orden: OrdenProduccion }) {
  const { ejecutar } = useData();
  const toast = useToast();
  const modal = useModal();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const back = () => modal.open(<OrderDetailModal ordenId={orden.id} />);

  const confirmar = async () => {
    if (motivo.trim().length < 5) return toast('Indique el motivo (mínimo 5 caracteres)', 'err');
    setSaving(true);
    const r = await ejecutar(() => produccionApi.cancelar(orden.id, motivo.trim()), ['dashboard']);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${orden.codigo} cancelada`, 'ok');
    back();
  };

  return (
    <Modal
      title={`Cancelar orden ${orden.codigo}`}
      footer={
        <>
          <button className="b b-out" onClick={back}>
            Volver
          </button>
          <button className="b b-red" onClick={confirmar} disabled={saving}>
            {saving ? 'Cancelando…' : 'Cancelar orden'}
          </button>
        </>
      }
    >
      <div className="note" style={{ marginBottom: 12 }}>
        <span className="ic">ℹ️</span>
        <div>La orden no ha descargado materiales del inventario. Quedará como cancelada (no se borra) para conservar la trazabilidad.</div>
      </div>
      <Field label="Motivo" htmlFor="op-cancel-motivo" full>
        <textarea id="op-cancel-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} placeholder="Ej: el cliente pospuso el pedido" />
      </Field>
    </Modal>
  );
}
