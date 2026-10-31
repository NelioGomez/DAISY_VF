/* Control de calidad de un lote: se inspeccionan todas las unidades pendientes (o las que
   vuelven de retrabajo). Las conformes entran al inventario; para las no conformes se decide
   la disposición: retrabajo, scrap (desecho) o liberación por concesión. */
import { useCallback, useState } from 'react';
import { Field } from '../../components/forms/Field';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import { money } from '../../utils/format';
import { cantidadCon } from '../../utils/units';
import { LotDetailModal } from './LotDetailModal';
import { OrderDetailModal } from './OrderDetailModal';
import { DISPOSICIONES, KEYS_STOCK, produccionApi, useProduccion, type Disposicion } from './productionApi';

interface Props {
  loteId: string;
  /** Al guardar, volver a la orden en lugar de al lote. */
  volverA?: { ordenId: string };
}

export function InspectLotModal({ loteId, volverA }: Props) {
  const { ejecutar } = useData();
  const toast = useToast();
  const modal = useModal();
  const load = useCallback(() => produccionApi.lote(loteId), [loteId]);
  const { data: l, error } = useProduccion(load);
  const [malas, setMalas] = useState('0');
  const [disp, setDisp] = useState<Disposicion | ''>('');
  const [defecto, setDefecto] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const back = () => modal.open(volverA ? <OrderDetailModal ordenId={volverA.ordenId} /> : <LotDetailModal loteId={loteId} />);

  const inicial = !!l && l.pendiente > 0;
  const total = l ? (inicial ? l.pendiente : l.retrabajo) : 0;
  const unidad = l?.producto?.unidad ?? 'UNIT';
  const nm = Number(malas);
  const valido = malas !== '' && Number.isInteger(nm) && nm >= 0 && nm <= total;
  const conformes = valido ? total - nm : 0;
  const alInventario = conformes + (valido && disp === 'RELEASE' ? nm : 0);

  const guardar = async () => {
    if (!l) return;
    if (!valido) return toast(`Las no conformes deben estar entre 0 y ${total}`, 'err');
    if (nm > 0 && !disp) return toast('Elija qué se hace con las unidades no conformes', 'err');
    if (nm > 0 && defecto.trim().length < 3) return toast('Describa el defecto encontrado', 'err');
    setSaving(true);
    const r = await ejecutar(
      () =>
        produccionApi.inspeccionar(l.id, {
          defectuosas: nm,
          ...(nm > 0 && disp ? { disposicion: disp } : {}),
          defecto: nm > 0 ? defecto.trim() : undefined,
          notas: notas.trim() || undefined,
        }),
      KEYS_STOCK,
    );
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    const qc = r.data.inspecciones[r.data.inspecciones.length - 1];
    toast(`${qc?.codigo ?? 'Inspección'} registrada: ${alInventario} u. entran al inventario`, 'ok');
    back();
  };

  return (
    <Modal
      title={l ? `Control de calidad · ${l.codigo}` : 'Control de calidad'}
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={guardar} disabled={saving || !l || total <= 0}>
            {saving ? 'Guardando…' : 'Registrar inspección'}
          </button>
        </>
      }
    >
      {error ? (
        <div className="note note-danger" role="alert">
          <span className="ic">⚠️</span>
          <div>{error}</div>
        </div>
      ) : !l ? (
        <ViewLoader text="Cargando lote…" />
      ) : total <= 0 ? (
        <div className="note">
          <span className="ic">ℹ️</span>
          <div>Este lote ya no tiene unidades por inspeccionar.</div>
        </div>
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                {l.producto?.nombre} <span className="mono muted-sm">{l.producto?.sku}</span>
              </div>
              <div className="doc-meta">
                {inicial ? 'Inspección inicial' : 'Re-inspección después del retrabajo'} de {cantidadCon(total, unidad)} · orden {l.orden?.codigo} · costo {money(l.costoUnit)} c/u
              </div>
            </div>
          </div>

          <div className="form-grid">
            <Field label="Unidades inspeccionadas">
              <input value={total} disabled />
            </Field>
            <Field label="No conformes" htmlFor="qc-bad" help={valido ? (nm === 0 ? 'Resultado: CONFORME' : 'Resultado: NO CONFORME') : `Entre 0 y ${total}`}>
              <input id="qc-bad" type="number" min={0} max={total} step={1} value={malas} onChange={(e) => setMalas(e.target.value)} autoFocus />
            </Field>
          </div>

          {valido && nm > 0 && (
            <>
              <fieldset className="qc-disp">
                <legend>{nm === 1 ? 'Disposición de la unidad no conforme' : `Disposición de las ${cantidadCon(nm, unidad)} no conformes`}</legend>
                {DISPOSICIONES.map((d) => (
                  <label key={d.id} className={disp === d.id ? 'on' : ''}>
                    <input type="radio" name="qc-disp" value={d.id} checked={disp === d.id} onChange={() => setDisp(d.id)} />
                    <span>
                      <b>{d.nombre}</b>
                      <small>{d.ayuda}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Field label="Defecto encontrado" htmlFor="qc-defect" full>
                <input id="qc-defect" value={defecto} onChange={(e) => setDefecto(e.target.value)} maxLength={500} placeholder="Ej: fuga en el terminal macho a 150 psi" />
              </Field>
            </>
          )}

          <Field label="Notas" htmlFor="qc-notes" full>
            <textarea id="qc-notes" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Prueba realizada, instrumento, observaciones…" />
          </Field>

          {valido && (
            <div className="totbox" style={{ width: 300 }}>
              <div className="r">
                <span>Conformes</span>
                <span>{conformes}</span>
              </div>
              {nm > 0 && (
                <div className="r">
                  <span>No conformes</span>
                  <span>
                    {nm} {disp ? `→ ${DISPOSICIONES.find((d) => d.id === disp)?.nombre.toLowerCase()}` : ''}
                  </span>
                </div>
              )}
              <div className="r grand">
                <span>Entran al inventario</span>
                <span>{cantidadCon(alInventario, unidad)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
