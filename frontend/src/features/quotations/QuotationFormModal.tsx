/* Nueva cotización, o cotización precargada a partir de una solicitud web (mejora n.° 45):
   cliente, productos y cantidades vienen de la solicitud; el vendedor revisa y confirma. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { LineEditor } from '../../components/forms/LineEditor';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import type { CartLine, ConsultaWeb } from '../../types';
import { QuotationDetailModal } from './QuotationDetailModal';

export function QuotationFormModal({ solicitud, clienteId }: { solicitud?: ConsultaWeb; clienteId?: string }) {
  const { db, crearCotizacion, cotizarConsulta } = useData();
  const toast = useToast();
  const modal = useModal();
  const activos = db.clientes.filter((c) => c.activo);
  // Desde una solicitud sin cliente vinculado se exige elegirlo (no se adivina por el nombre).
  const [cliId, setCliId] = useState(solicitud ? (solicitud.cliente?.id ?? '') : (clienteId ?? activos[0]?.id ?? ''));
  const [lines, setLines] = useState<CartLine[]>(() =>
    solicitud?.items.length ? solicitud.items.filter((i) => i.activo).map((i) => ({ prod: i.prod, cant: i.cant })) : [{ prod: '', cant: 1 }],
  );
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const inactivos = solicitud?.items.filter((i) => !i.activo) ?? [];

  const save = async () => {
    if (!cliId) return toast('Seleccione un cliente', 'err');
    if (!lines.some((l) => l.prod && l.cant > 0)) return toast('Agregue al menos un producto', 'err');
    setSaving(true);
    const r = solicitud ? await cotizarConsulta(solicitud.id, { cliId, lineas: lines, notas }) : await crearCotizacion(cliId, lines, notas);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(solicitud ? `Cotización ${r.data.codigo} creada desde ${solicitud.codigo}` : `Cotización ${r.data.codigo} generada`, 'ok');
    modal.open(<QuotationDetailModal cotizacionId={r.data.id} />);
  };

  return (
    <Modal
      title={solicitud ? `Cotizar solicitud ${solicitud.codigo}` : 'Nueva cotización'}
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={save} disabled={saving}>
            {saving ? 'Generando…' : 'Generar cotización'}
          </button>
        </>
      }
    >
      {solicitud && (
        <div className="card soft-card" style={{ marginBottom: 14 }}>
          <b>{solicitud.nombre}</b> · <span className="mono">{solicitud.contacto}</span>
          {solicitud.msg && <div className="doc-meta">“{solicitud.msg}”</div>}
          {!solicitud.items.length && solicitud.producto && <div className="doc-meta">Producto de interés: {solicitud.producto}</div>}
        </div>
      )}
      <Field label="Cliente" htmlFor="qf-cliente" help={solicitud && !solicitud.cliente ? 'La solicitud llegó sin cuenta: elija el cliente (o regístrelo en Clientes)' : undefined}>
        <select id="qf-cliente" value={cliId} onChange={(e) => setCliId(e.target.value)}>
          {(!cliId || (solicitud && !solicitud.cliente)) && <option value="">— Seleccione el cliente —</option>}
          {activos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Field>
      {inactivos.length > 0 && (
        <div className="note note-warn" style={{ marginBottom: 10 }}>
          <span className="ic">⚠️</span>
          <div>No se incluyeron productos inactivos: {inactivos.map((i) => i.sku).join(', ')}.</div>
        </div>
      )}
      <LineEditor lines={lines} onChange={setLines} />
      <Field label="Notas para el cliente" full>
        <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" maxLength={500} />
      </Field>
      <div className="note">
        <span className="ic">ℹ️</span>
        <div>
          Los precios e impuestos definitivos los calcula el servidor. La cotización vale 15 días desde su emisión.
          {solicitud && ' La solicitud quedará como Cotizada y enlazada a esta cotización.'}
        </div>
      </div>
    </Modal>
  );
}
