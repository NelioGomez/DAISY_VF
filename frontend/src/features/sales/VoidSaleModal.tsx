/* Anulación de una venta (permiso sales:void). El servidor devuelve el
   stock al inventario y deja la venta con estado ANULADA y su motivo. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useData } from '../../store/hooks';
import type { Venta } from '../../types';
import { money } from '../../utils/format';
import { useRecords } from '../records/records';

export function VoidSaleModal({ venta }: { venta: Venta }) {
  const { anularVenta } = useData();
  const toast = useToast();
  const { openRecord } = useRecords();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (motivo.trim().length < 5) return toast('Indique el motivo (mínimo 5 caracteres)', 'err');
    setSaving(true);
    const r = await anularVenta(venta.id, motivo.trim());
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Venta ${venta.factura} anulada`, 'ok');
    openRecord('venta', venta.id);
  };

  return (
    <Modal
      title={`Anular ${venta.factura}`}
      footer={
        <>
          <CancelButton label="Volver" />
          <button className="b b-red" onClick={submit} disabled={saving}>
            {saving ? 'Anulando…' : 'Anular venta'}
          </button>
        </>
      }
    >
      <div className="note" style={{ marginBottom: 14 }}>
        <span className="ic">⚠️</span>
        <div>
          Se anulará la venta de <b>{venta.cliN}</b> por <b>{money(venta.total)}</b>. Las unidades vuelven al inventario. Esta acción queda en
          auditoría y no se puede deshacer.
        </div>
      </div>
      <Field label="Motivo de la anulación">
        <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: error en la cantidad facturada" />
      </Field>
    </Modal>
  );
}
