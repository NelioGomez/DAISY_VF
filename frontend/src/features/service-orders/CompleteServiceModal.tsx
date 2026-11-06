/* Completar una orden de servicio (mejora n.° 60): resumen del trabajo realizado y la garantía
   que NORCOR da sobre ese trabajo (90 días por omisión). Si la falla vuelve dentro de ese plazo,
   el reclamo se registra en garantía y no se cobra. Una orden que ya estaba en garantía queda
   cerrada al completarse, sin factura. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { OrdenServicio } from '../../types';
import { fmtDate, isoInDays } from '../../utils/format';
import { plazoGarantia } from '../../utils/warranty';
import { useRecords } from '../records/records';

const PLAZOS = [0, 30, 60, 90, 180, 365];

export function CompleteServiceModal({ orden, desdeDetalle = false }: { orden: OrdenServicio; desdeDetalle?: boolean }) {
  const { completarOrden } = useData();
  const toast = useToast();
  const { close } = useModal();
  const { openRecord } = useRecords();
  const [resumen, setResumen] = useState('');
  const [dias, setDias] = useState(90);
  const [saving, setSaving] = useState(false);
  const back = () => (desdeDetalle ? openRecord('servicio', orden.id) : close());

  const guardar = async () => {
    setSaving(true);
    const r = await completarOrden(orden.id, resumen, dias);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${orden.codigo} completada${orden.enGarantia ? ' en garantía (sin costo)' : ''}`, 'ok');
    back();
  };

  return (
    <Modal
      title={`Completar ${orden.codigo}`}
      footer={
        <>
          <button className="b b-out" onClick={back}>
            Volver
          </button>
          <button className="b b-green" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Completar orden'}
          </button>
        </>
      }
    >
      <p className="muted-sm" style={{ marginBottom: 12 }}>
        {orden.cli} · {orden.desc}
      </p>
      <Field label="Trabajo realizado" htmlFor="opi-resumen" help="Queda en las notas de la orden. Ej.: se cambió el sello mecánico y se probó 30 min.">
        <textarea id="opi-resumen" rows={3} maxLength={1000} value={resumen} onChange={(e) => setResumen(e.target.value)} autoFocus />
      </Field>
      <Field label="Garantía del trabajo" htmlFor="opi-garantia" help={dias > 0 ? `Cubre el mismo trabajo hasta el ${fmtDate(isoInDays(dias))}.` : 'El cliente no tendrá garantía sobre este trabajo.'}>
        <select id="opi-garantia" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {PLAZOS.map((d) => (
            <option key={d} value={d}>
              {d === 0 ? 'Sin garantía' : `${plazoGarantia(d)}${d === 90 ? ' (habitual)' : ''}`}
            </option>
          ))}
        </select>
      </Field>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>
          {orden.enGarantia ? (
            <>
              Esta orden está <b>en garantía</b>: al completarla queda cerrada y no se factura.
            </>
          ) : (
            <>
              Después de completarla, factúrela contra la venta del servicio. Si la falla vuelve dentro de la garantía del trabajo, el reclamo se registra
              sin costo.
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
