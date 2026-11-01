/* Terminar una orden: las unidades buenas forman un lote que queda pendiente de calidad.
   El costo de los materiales consumidos se reparte entre las unidades producidas. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { Modal } from '../../components/modals/Modal';
import { useData } from '../../store/hooks';
import { money } from '../../utils/format';
import { cantidadCon } from '../../utils/units';
import { produccionApi, type OrdenProduccion } from './productionApi';
import { useRecords } from '../records/records';

export function CompleteOrderModal({ orden }: { orden: OrdenProduccion }) {
  const { ejecutar } = useData();
  const toast = useToast();
  const { openRecord } = useRecords();
  const [cant, setCant] = useState(String(orden.cantidad));
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const back = () => openRecord('produccion', orden.id);

  const n = Number(cant);
  const valido = cant !== '' && Number.isInteger(n) && n >= 0 && n <= orden.cantidad;
  const merma = valido ? orden.cantidad - n : 0;

  const guardar = async () => {
    if (!valido) return toast(`Indique un número entero entre 0 y ${orden.cantidad}`, 'err');
    if (merma > 0 && notas.trim().length < 5) return toast('Explique en las notas por qué se produjo menos de lo planificado', 'err');
    setSaving(true);
    const r = await ejecutar(() => produccionApi.terminar(orden.id, n, notas.trim() || undefined), ['dashboard']);
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    const lote = r.data.lotes[r.data.lotes.length - 1];
    toast(lote ? `${orden.codigo} terminada: lote ${lote.codigo} (${n} u.) pendiente de calidad` : `${orden.codigo} terminada sin unidades`, 'ok');
    back();
  };

  return (
    <Modal
      title={`Terminar orden ${orden.codigo}`}
      footer={
        <>
          <button className="b b-out" onClick={back}>
            Volver
          </button>
          <button className="b b-amber" onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Terminar y crear lote'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={`Unidades producidas (máx. ${orden.cantidad})`} htmlFor="op-done-qty" help={valido ? cantidadCon(n, orden.producto.unidad) : undefined}>
          <input id="op-done-qty" type="number" min={0} max={orden.cantidad} step={1} value={cant} onChange={(e) => setCant(e.target.value)} autoFocus />
        </Field>
        <Field label="Costo por unidad" help="Materiales consumidos ÷ unidades producidas">
          <input value={valido && n > 0 ? money(orden.costoMateriales / n) : '—'} disabled />
        </Field>
        <Field label="Notas" htmlFor="op-done-notes" full>
          <textarea id="op-done-notes" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} placeholder={merma > 0 ? 'Obligatorio: motivo de la merma' : 'Observaciones de la corrida (opcional)'} />
        </Field>
      </div>
      {merma > 0 && (
        <div className="note note-warn" style={{ marginTop: 10 }}>
          <span className="ic">⚠️</span>
          <div>
            Se planificaron {orden.cantidad} y se terminan {n}: las {merma} unidades restantes quedan como merma de producción (sus materiales ya se consumieron y bajan el rendimiento).
          </div>
        </div>
      )}
      <div className="note" style={{ marginTop: 10 }}>
        <span className="ic">ℹ️</span>
        <div>
          Las unidades forman un <b>lote</b> que queda <b>pendiente de inspección</b>. Entran al inventario de {orden.producto.sku} cuando calidad las libera.
        </div>
      </div>
    </Modal>
  );
}
