import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { Cotizacion } from '../../types';

export function RejectQuotationModal({ cotizacion }: { cotizacion: Cotizacion }) {
  const { cambiarEstadoCotizacion } = useData();
  const toast = useToast();
  const { close } = useModal();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const r = await cambiarEstadoCotizacion(cotizacion.id, 'reject', motivo.trim());
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${cotizacion.codigo} rechazada`, 'ok');
    close();
  };

  return (
    <Modal
      title={`Rechazar ${cotizacion.codigo}`}
      footer={
        <>
          <CancelButton label="Volver" />
          <button className="b b-red" onClick={submit} disabled={saving}>
            {saving ? 'Rechazando…' : 'Rechazar cotización'}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
        La cotización de <b>{cotizacion.cliN}</b> quedará cerrada y no podrá convertirse en venta.
      </p>
      <Field label="Motivo (opcional)">
        <textarea rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: el cliente eligió otro proveedor" />
      </Field>
    </Modal>
  );
}
