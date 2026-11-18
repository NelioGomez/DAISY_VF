/* Nueva orden de producción: el producto se fabrica con su BOM y su ruta vigentes.
   Muestra cuánto material se necesita y si alcanza lo que hay en bodega. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useState } from 'react';
import { Field } from '../../components/forms/Field';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { useData } from '../../store/hooks';
import { money, todayISO } from '../../utils/format';
import { cantidadCon } from '../../utils/units';
import { BomFormModal } from './BomFormModal';
import { OrderDetailModal } from './OrderDetailModal';
import { produccionApi, useProduccion } from './productionApi';
import { fmtMinutos } from './productionFormat';

export function OrderFormModal() {
  const { db, ejecutar } = useData();
  const toast = useToast();
  const modal = useModal();
  const boms = useProduccion(produccionApi.boms);
  const rutas = useProduccion(produccionApi.rutas);
  const vigentes = (boms.data ?? []).filter((b) => b.vigente && b.producto.activo);
  const [elegido, setElegido] = useState('');
  const productoId = elegido || (vigentes.length === 1 ? vigentes[0].producto.id : '');
  const [cant, setCant] = useState('5');
  const [inicio, setInicio] = useState(todayISO());
  const [entrega, setEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const bom = vigentes.find((b) => b.producto.id === productoId);
  const ruta = (rutas.data ?? []).find((r) => r.vigente && r.producto.id === productoId);
  const n = Number(cant);
  const qty = Number.isInteger(n) && n > 0 ? n : 0;
  // El stock del store se actualiza en tiempo real; el de la BOM es el del momento en que se cargó.
  const stockDe = (id: string, fallback: number) => db.productos.find((p) => p.id === id)?.stock ?? fallback;
  const lineas = (bom?.items ?? []).map((i) => {
    const requerido = i.cantidad * qty;
    const enBodega = stockDe(i.componente.id, i.componente.stock);
    return { ...i, requerido, enBodega, falta: Math.max(0, requerido - enBodega) };
  });
  const costo = lineas.reduce((t, l) => t + l.requerido * l.componente.costo, 0);
  const faltan = lineas.filter((l) => l.falta > 0);

  const guardar = async () => {
    if (!bom) return toast('Elija el producto a fabricar', 'err');
    if (!qty) return toast('La cantidad debe ser un número entero mayor que cero', 'err');
    if (entrega && inicio && entrega < inicio) return toast('La entrega no puede ser antes del inicio', 'err');
    setSaving(true);
    const r = await ejecutar(
      () => produccionApi.crearOrden({ productoId: bom.producto.id, cantidad: qty, inicioPlan: inicio || undefined, entrega: entrega || undefined, notas: notas.trim() || undefined }),
      [],
    );
    setSaving(false);
    if (!r.ok) return toast(r.error, 'err');
    toast(`Orden ${r.data.codigo} creada: libérela para que planta la inicie`, 'ok');
    modal.open(<OrderDetailModal ordenId={r.data.id} />);
  };

  const cargando = boms.loading || rutas.loading;

  return (
    <Modal
      title="Nueva orden de producción"
      wide
      footer={
        <>
          <CancelButton />
          <button className="b b-amber" onClick={guardar} disabled={saving || !bom}>
            {saving ? 'Creando…' : 'Crear orden'}
          </button>
        </>
      }
    >
      {boms.error ? (
        <ErrorState msg={boms.error} onRetry={boms.reload} />
      ) : cargando ? (
        <ViewLoader text="Cargando listas de materiales…" />
      ) : !vigentes.length ? (
        <div className="note note-warn">
          <span className="ic">⚠️</span>
          <div>
            Ningún producto tiene lista de materiales vigente. Registre primero de qué se compone el producto terminado.{' '}
            <button className="b b-out b-sm" onClick={() => modal.open(<BomFormModal />)}>
              + Nueva lista de materiales
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Producto a fabricar" htmlFor="op-prod" full>
              <select id="op-prod" value={productoId} onChange={(e) => setElegido(e.target.value)}>
                <option value="">— Seleccione —</option>
                {vigentes.map((b) => (
                  <option key={b.id} value={b.producto.id}>
                    {b.producto.nombre} ({b.producto.sku}) · {b.codigo} v{b.version}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cantidad a producir" htmlFor="op-qty" help={bom && qty ? cantidadCon(qty, bom.producto.unidad) : undefined}>
              <input id="op-qty" type="number" min={1} step={1} value={cant} onChange={(e) => setCant(e.target.value)} />
            </Field>
            <Field label="Costo estimado de materiales" help="Con el costo promedio actual de cada componente">
              <input value={money(costo)} disabled />
            </Field>
            <Field label="Inicio planificado" htmlFor="op-ini">
              <input id="op-ini" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Field>
            <Field label="Fecha de entrega" htmlFor="op-due">
              <input id="op-due" type="date" value={entrega} min={inicio || undefined} onChange={(e) => setEntrega(e.target.value)} />
            </Field>
          </div>

          {bom && (
            <>
              <h4 className="section-title">Materiales requeridos ({bom.codigo})</h4>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th className="num">Por unidad</th>
                      <th className="num">Requerido</th>
                      <th className="num">En bodega</th>
                      <th className="num">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.componente.nombre} <span className="mono muted-sm">{l.componente.sku}</span>
                        </td>
                        <td className="num">{cantidadCon(l.cantidad, l.componente.unidad)}</td>
                        <td className="num">
                          <b>{cantidadCon(l.requerido, l.componente.unidad)}</b>
                        </td>
                        <td className="num" style={l.falta ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                          {l.enBodega}
                          {l.falta > 0 && <div className="sub-num">faltan {l.falta}</div>}
                        </td>
                        <td className="num">{money(l.requerido * l.componente.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {faltan.length > 0 && (
                <div className="note note-warn" style={{ marginTop: 10 }}>
                  <span className="ic">⚠️</span>
                  <div>
                    No alcanza el material para iniciar hoy ({faltan.map((l) => l.componente.sku).join(', ')}). Puede crear y liberar la orden; se podrá <b>iniciar</b> cuando se reciba la compra.
                  </div>
                </div>
              )}

              <h4 className="section-title">Ruta</h4>
              {ruta ? (
                <p className="doc-meta">
                  <b className="mono">{ruta.codigo}</b> {ruta.nombre}: {ruta.operaciones.map((o) => o.nombre).join(' → ')} · tiempo estándar{' '}
                  {fmtMinutos(ruta.minutosPorUnidad * (qty || 1))}
                </p>
              ) : (
                <p className="doc-meta">El producto no tiene ruta vigente: la orden no tendrá pasos que registrar.</p>
              )}
            </>
          )}

          <Field label="Notas" htmlFor="op-notes" full>
            <textarea id="op-notes" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={1000} placeholder="Pedido del cliente, prioridad, instrucciones…" />
          </Field>
        </>
      )}
    </Modal>
  );
}
