/* Acciones de una orden que necesitan un dato: asignar técnico,
   facturar contra una venta del cliente o cancelar con motivo. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { OrdenServicio } from '../../types';
import { fmtDate, money } from '../../utils/format';

type Mode = 'assign' | 'invoice' | 'cancel';

const TITLES: Record<Mode, string> = { assign: 'Asignar técnico', invoice: 'Facturar orden', cancel: 'Cancelar orden' };

export function OrderActionModal({ orden, mode }: { orden: OrdenServicio; mode: Mode }) {
  const { db, asignarOrden, facturarOrden, cancelarOrden } = useData();
  const toast = useToast();
  const { close } = useModal();
  const ventasCliente = db.ventas.filter((v) => v.cli === orden.cliId && v.estado !== 'Anulada');
  const [value, setValue] = useState(mode === 'assign' ? (orden.tecnicoId ?? db.tecnicos[0]?.id ?? '') : mode === 'invoice' ? (ventasCliente[0]?.id ?? '') : '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (mode === 'cancel' && value.trim().length < 5) return toast('Indique el motivo (mínimo 5 caracteres)', 'err');
    if (mode !== 'cancel' && !value) return toast(mode === 'assign' ? 'Seleccione un técnico' : 'Seleccione la venta', 'err');
    setSaving(true);
    const r = mode === 'assign' ? await asignarOrden(orden.id, value) : mode === 'invoice' ? await facturarOrden(orden.id, value) : await cancelarOrden(orden.id, value.trim());
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${orden.codigo}: ${mode === 'assign' ? 'técnico asignado' : mode === 'invoice' ? 'facturada' : 'cancelada'}`, 'ok');
    close();
  };

  return (
    <Modal
      title={`${TITLES[mode]} — ${orden.codigo}`}
      footer={
        <>
          <CancelButton label="Volver" />
          <button className={`b ${mode === 'cancel' ? 'b-red' : 'b-amber'}`} onClick={submit} disabled={saving || (mode === 'invoice' && !ventasCliente.length)}>
            {saving ? 'Guardando…' : TITLES[mode]}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
        {orden.cli} · {orden.desc}
      </p>
      {mode === 'assign' && (
        <Field label="Técnico">
          <select value={value} onChange={(e) => setValue(e.target.value)}>
            {db.tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Field>
      )}
      {mode === 'invoice' &&
        (ventasCliente.length ? (
          <Field label="Venta que factura el servicio">
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              {ventasCliente.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.factura} · {fmtDate(v.fecha)} · {money(v.total)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="note">
            <span className="ic">ℹ️</span>
            <div>Este cliente no tiene ventas activas. Registre primero la venta del servicio en Ventas y Facturación.</div>
          </div>
        ))}
      {mode === 'cancel' && (
        <Field label="Motivo de la cancelación">
          <textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ej: el cliente pospuso el trabajo" />
        </Field>
      )}
    </Modal>
  );
}
