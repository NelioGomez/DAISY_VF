/* Alta y edición de una lista de materiales (BOM). Las cantidades son por cada unidad del
   producto terminado, en la unidad de control de cada componente (p. ej. 10 pies de manguera).
   Si la BOM ya se usó en órdenes, guardar crea una versión nueva y conserva la anterior. */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useAuth, useData } from '../../store/hooks';
import { money } from '../../utils/format';
import { nombreUnidad, unidadSingular } from '../../utils/units';
import { produccionApi, type ListaMateriales } from './productionApi';

interface Linea {
  componenteId: string;
  cantidad: string;
}

export function BomFormModal({ bom }: { bom?: ListaMateriales }) {
  const { db, ejecutar } = useData();
  const { can } = useAuth();
  const canWrite = can('production:write');
  const toast = useToast();
  const { close } = useModal();
  const [productoId, setProductoId] = useState(bom?.producto.id ?? '');
  const [lineas, setLineas] = useState<Linea[]>(
    bom?.items.length ? bom.items.map((i) => ({ componenteId: i.componente.id, cantidad: String(i.cantidad) })) : [{ componenteId: '', cantidad: '1' }],
  );
  const [notas, setNotas] = useState(bom?.notas ?? '');
  const [saving, setSaving] = useState<'save' | 'status' | null>(null);

  const productos = db.productos.filter((p) => p.activo || p.id === productoId);
  const componentes = db.productos.filter((p) => (p.activo || lineas.some((l) => l.componenteId === p.id)) && p.id !== productoId);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const costo = lineas.reduce((t, l) => t + (prod(l.componenteId)?.costo ?? 0) * (Number(l.cantidad) || 0), 0);
  const nuevaVersion = !!bom && bom.ordenes > 0;

  const setLinea = (i: number, patch: Partial<Linea>) => setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const guardar = async () => {
    if (!productoId) return toast('Elija el producto terminado', 'err');
    const validas = lineas.filter((l) => l.componenteId);
    if (!validas.length) return toast('Agregue al menos un componente', 'err');
    const ids = validas.map((l) => l.componenteId);
    if (new Set(ids).size !== ids.length) return toast('Hay componentes repetidos: sume las cantidades en una sola línea', 'err');
    if (validas.some((l) => !Number.isInteger(Number(l.cantidad)) || Number(l.cantidad) < 1)) return toast('Las cantidades deben ser enteros mayores que cero', 'err');
    setSaving('save');
    const r = await ejecutar(
      () => produccionApi.guardarBom(bom?.id ?? null, { productoId, items: validas.map((l) => ({ componenteId: l.componenteId, cantidad: Number(l.cantidad) })), notas }),
      [],
    );
    setSaving(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(r.data.reemplaza ? `Versión ${r.data.version} creada (${r.data.codigo}); ${r.data.reemplaza} queda como historial` : `Lista de materiales ${r.data.codigo} guardada`, 'ok');
    close();
  };

  const cambiarEstado = async () => {
    if (!bom) return;
    setSaving('status');
    const r = await ejecutar(() => produccionApi.estadoBom(bom.id, !bom.vigente), []);
    setSaving(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(r.data.vigente ? `${bom.codigo} es ahora la versión vigente` : `${bom.codigo} desactivada`, 'ok');
    close();
  };

  return (
    <Modal
      title={bom ? `Lista de materiales ${bom.codigo} · v${bom.version}` : 'Nueva lista de materiales'}
      wide
      footer={
        <>
          {bom && canWrite && (
            <button className={bom.vigente ? 'b b-red' : 'b b-out'} style={{ marginRight: 'auto' }} onClick={cambiarEstado} disabled={!!saving}>
              {bom.vigente ? 'Desactivar' : 'Hacer vigente'}
            </button>
          )}
          <CancelButton label={canWrite ? 'Cancelar' : 'Cerrar'} />
          {canWrite && (
            <button className="b b-amber" onClick={guardar} disabled={!!saving}>
              {saving === 'save' ? 'Guardando…' : nuevaVersion ? `Guardar como versión ${bom!.version + 1}` : 'Guardar'}
            </button>
          )}
        </>
      }
    >
      <div className="form-grid">
        <Field label="Producto terminado" htmlFor="bom-prod" full help={bom ? 'El producto de una lista no se cambia: cree otra para otro producto' : 'Lo que se ensambla (p. ej. manguera armada con terminales)'}>
          <select id="bom-prod" value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={!!bom || !canWrite}>
            <option value="">— Seleccione —</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.sku})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="li-head li-bom">
        <span>Componente</span>
        <span>Cantidad por unidad</span>
        <span>Costo prom.</span>
        <span>Subtotal</span>
        <span />
      </div>
      {lineas.map((l, i) => {
        const c = prod(l.componenteId);
        const q = Number(l.cantidad) || 0;
        return (
          <div className="li-row li-bom" key={i}>
            <select value={l.componenteId} onChange={(e) => setLinea(i, { componenteId: e.target.value })} aria-label={`Componente de la línea ${i + 1}`} disabled={!canWrite}>
              <option value="">— componente —</option>
              {componentes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.sku}) · stock {p.stock} {nombreUnidad(p.stock, p.unidad)}
                </option>
              ))}
            </select>
            <div className="qty-unit">
              <input type="number" min={1} step={1} value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: e.target.value })} aria-label={`Cantidad de la línea ${i + 1}`} disabled={!canWrite} />
              <span>{c ? nombreUnidad(q, c.unidad) : ''}</span>
            </div>
            <input value={c ? `${money(c.costo)} / ${unidadSingular(c.unidad)}` : ''} disabled aria-label={`Costo promedio de la línea ${i + 1}`} />
            <input value={money((c?.costo ?? 0) * q)} disabled aria-label={`Subtotal de la línea ${i + 1}`} />
            <button
              className="icon-btn"
              style={{ width: 32, height: 32 }}
              onClick={() => setLineas((ls) => ls.filter((_, idx) => idx !== i))}
              aria-label={`Quitar línea ${i + 1}`}
              disabled={lineas.length === 1 || !canWrite}
            >
              ×
            </button>
          </div>
        );
      })}
      {canWrite && (
        <button className="b b-out b-sm" style={{ marginTop: 6 }} onClick={() => setLineas((ls) => [...ls, { componenteId: '', cantidad: '1' }])}>
          + Agregar componente
        </button>
      )}

      <div className="totbox">
        <div className="r grand">
          <span>Materiales por unidad</span>
          <span>{money(costo)}</span>
        </div>
      </div>

      <Field label="Notas" htmlFor="bom-notes" full>
        <textarea id="bom-notes" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Especificación, tolerancias, proveedor recomendado…" disabled={!canWrite} />
      </Field>

      <div className={`note ${nuevaVersion ? 'note-warn' : ''}`} style={{ marginTop: 10 }}>
        <span className="ic">{nuevaVersion ? '⚠️' : 'ℹ️'}</span>
        <div>
          {nuevaVersion ? (
            <>
              Esta lista ya se usó en <b>{bom!.ordenes}</b> orden(es). Al guardar se crea la <b>versión {bom!.version + 1}</b> y la actual queda como historial: las órdenes
              existentes conservan sus materiales.
            </>
          ) : (
            <>Una sola versión vigente por producto. El costo es una referencia con el costo promedio actual; el real se calcula al iniciar cada orden.</>
          )}
        </div>
      </div>
    </Modal>
  );
}
