/* Alta y edición de una ruta de producción. Las operaciones se numeran 10, 20, 30… en el
   orden en que se listan. Cambiar la ruta no altera las órdenes ya creadas (guardan su copia). */
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useAuth, useData } from '../../store/hooks';
import { produccionApi, type RutaProduccion } from './productionApi';
import { fmtMinutos } from './productionFormat';

interface Op {
  nombre: string;
  centro: string;
  minutos: string;
  instrucciones: string;
}

const VACIA: Op = { nombre: '', centro: '', minutos: '5', instrucciones: '' };

export function RouteFormModal({ ruta }: { ruta?: RutaProduccion }) {
  const { db, ejecutar } = useData();
  const { can } = useAuth();
  const canWrite = can('production:write');
  const toast = useToast();
  const { close } = useModal();
  const [productoId, setProductoId] = useState(ruta?.producto.id ?? '');
  const [nombre, setNombre] = useState(ruta?.nombre ?? '');
  const [ops, setOps] = useState<Op[]>(
    ruta?.operaciones.length
      ? ruta.operaciones.map((o) => ({ nombre: o.nombre, centro: o.centro, minutos: String(o.minutos), instrucciones: o.instrucciones }))
      : [{ ...VACIA }],
  );
  const [saving, setSaving] = useState<'save' | 'status' | null>(null);

  const productos = db.productos.filter((p) => p.activo || p.id === productoId);
  const total = ops.reduce((t, o) => t + (Number(o.minutos) || 0), 0);
  const setOp = (i: number, patch: Partial<Op>) => setOps((xs) => xs.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const mover = (i: number, d: -1 | 1) =>
    setOps((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const guardar = async () => {
    if (!productoId) return toast('Elija el producto', 'err');
    if (!nombre.trim()) return toast('Ponga un nombre a la ruta', 'err');
    const validas = ops.filter((o) => o.nombre.trim());
    if (!validas.length) return toast('Agregue al menos una operación', 'err');
    if (validas.some((o) => !Number.isInteger(Number(o.minutos)) || Number(o.minutos) < 0)) return toast('Los minutos estándar deben ser enteros (0 o más)', 'err');
    setSaving('save');
    const r = await ejecutar(
      () =>
        produccionApi.guardarRuta(ruta?.id ?? null, {
          productoId,
          nombre,
          operaciones: validas.map((o) => ({ nombre: o.nombre, centro: o.centro, minutos: Number(o.minutos), instrucciones: o.instrucciones })),
        }),
      [],
    );
    setSaving(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Ruta ${r.data.codigo} guardada (${r.data.operaciones.length} operaciones)`, 'ok');
    close();
  };

  const cambiarEstado = async () => {
    if (!ruta) return;
    setSaving('status');
    const r = await ejecutar(() => produccionApi.estadoRuta(ruta.id, !ruta.vigente), []);
    setSaving(null);
    if (!r.ok) return toast(r.error, 'err');
    toast(r.data.vigente ? `${ruta.codigo} es ahora la ruta vigente` : `${ruta.codigo} desactivada`, 'ok');
    close();
  };

  return (
    <Modal
      title={ruta ? `Ruta ${ruta.codigo}` : 'Nueva ruta de producción'}
      wide
      footer={
        <>
          {ruta && canWrite && (
            <button className={ruta.vigente ? 'b b-red' : 'b b-out'} style={{ marginRight: 'auto' }} onClick={cambiarEstado} disabled={!!saving}>
              {ruta.vigente ? 'Desactivar' : 'Hacer vigente'}
            </button>
          )}
          <CancelButton label={canWrite ? 'Cancelar' : 'Cerrar'} />
          {canWrite && (
            <button className="b b-amber" onClick={guardar} disabled={!!saving}>
              {saving === 'save' ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </>
      }
    >
      <div className="form-grid">
        <Field label="Producto" htmlFor="rt-prod">
          <select id="rt-prod" value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={!!ruta || !canWrite}>
            <option value="">— Seleccione —</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.sku})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre de la ruta" htmlFor="rt-name">
          <input id="rt-name" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder='Ej: Ensamble de manguera 3/4"' disabled={!canWrite} />
        </Field>
      </div>

      <h4 className="section-title">Operaciones (en orden)</h4>
      <ol className="route-form">
        {ops.map((o, i) => (
          <li key={i}>
            <span className="seq mono" aria-hidden="true">
              {(i + 1) * 10}
            </span>
            <div className="route-fields">
              <input value={o.nombre} onChange={(e) => setOp(i, { nombre: e.target.value })} placeholder="Operación (p. ej. Medición y corte)" maxLength={120} aria-label={`Nombre de la operación ${i + 1}`} disabled={!canWrite} />
              <input value={o.centro} onChange={(e) => setOp(i, { centro: e.target.value })} placeholder="Centro de trabajo" maxLength={80} aria-label={`Centro de trabajo de la operación ${i + 1}`} disabled={!canWrite} />
              <div className="qty-unit">
                <input type="number" min={0} step={1} value={o.minutos} onChange={(e) => setOp(i, { minutos: e.target.value })} aria-label={`Minutos estándar de la operación ${i + 1}`} disabled={!canWrite} />
                <span>min/u.</span>
              </div>
              <input
                className="full"
                value={o.instrucciones}
                onChange={(e) => setOp(i, { instrucciones: e.target.value })}
                placeholder="Instrucciones o criterio de aceptación (opcional)"
                maxLength={500}
                aria-label={`Instrucciones de la operación ${i + 1}`}
                disabled={!canWrite}
              />
            </div>
            {canWrite && (
              <div className="route-btns">
                <button className="icon-btn" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir la operación ${i + 1}`}>
                  ↑
                </button>
                <button className="icon-btn" onClick={() => mover(i, 1)} disabled={i === ops.length - 1} aria-label={`Bajar la operación ${i + 1}`}>
                  ↓
                </button>
                <button className="icon-btn" onClick={() => setOps((xs) => xs.filter((_, idx) => idx !== i))} disabled={ops.length === 1} aria-label={`Quitar la operación ${i + 1}`}>
                  ×
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {canWrite && (
        <button className="b b-out b-sm" onClick={() => setOps((xs) => [...xs, { ...VACIA }])}>
          + Agregar operación
        </button>
      )}

      <div className="totbox">
        <div className="r grand">
          <span>Tiempo estándar por unidad</span>
          <span>{fmtMinutos(total)}</span>
        </div>
      </div>

      <div className="note" style={{ marginTop: 10 }}>
        <span className="ic">ℹ️</span>
        <div>Cada orden de producción copia estas operaciones como sus pasos: en planta se marcan hechas en este orden. Editar la ruta no cambia las órdenes ya creadas.</div>
      </div>
    </Modal>
  );
}
