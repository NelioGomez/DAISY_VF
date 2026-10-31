/* Detalle de una orden de producción: materiales de la BOM, pasos de la ruta, lotes con su
   inspección de calidad y los movimientos de inventario que generó. Desde aquí se libera,
   se inicia (descarga los materiales), se registran los pasos, se termina o se cancela. */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useCallback, useState } from 'react';
import { DocChain } from '../../components/common/DocChain';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { useToast } from '../../components/feedback/useToast';
import { CancelButton, Modal } from '../../components/modals/Modal';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, TipoMovTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { RefreshKey } from '../../store/storeContext';
import { fmtDate, fmtDateTime, money } from '../../utils/format';
import { cantidadCon } from '../../utils/units';
import { PurchaseFormModal } from '../purchases/PurchaseFormModal';
import { CancelOrderModal } from './CancelOrderModal';
import { CompleteOrderModal } from './CompleteOrderModal';
import { InspectLotModal } from './InspectLotModal';
import { LotDetailModal } from './LotDetailModal';
import { KEYS_STOCK, nombreDisposicion, produccionApi, useProduccion, type OrdenProduccion } from './productionApi';
import { fmtHoras, fmtMinutos } from './productionFormat';

const FLUJO = ['Borrador', 'Liberada', 'En proceso', 'Terminada'] as const;

export function OrderDetailModal({ ordenId }: { ordenId: string }) {
  const { ejecutar } = useData();
  const { can } = useAuth();
  const canWrite = can('production:write');
  const canStart = canWrite && can('inventory:write');
  const canQc = can('quality:write');
  const toast = useToast();
  const modal = useModal();
  const load = useCallback(() => produccionApi.orden(ordenId), [ordenId]);
  const { data: o, error, set, reload } = useProduccion(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const act = async (key: string, fn: () => Promise<OrdenProduccion>, msg: (x: OrdenProduccion) => string, keys: RefreshKey[] = []) => {
    setBusy(key);
    const r = await ejecutar(fn, keys);
    setBusy(null);
    setConfirmar(false);
    if (!r.ok) return toast(r.error, 'err');
    set(r.data);
    toast(msg(r.data), 'ok');
  };

  const faltantes = o?.materiales.filter((m) => m.faltante > 0) ?? [];
  const siguiente = o?.estado === 'En proceso' ? o.pasos.find((p) => !p.hecho) : undefined;
  const pasosListos = !!o && o.pasos.every((p) => p.hecho);
  const lotePendiente = o?.lotes.find((l) => l.estado === 'Por inspeccionar' || l.estado === 'En retrabajo');
  const liberadas = o?.lotes.reduce((t, l) => t + l.liberada, 0) ?? 0;
  const desechadas = o?.lotes.reduce((t, l) => t + l.desechada, 0) ?? 0;

  return (
    <Modal
      title={o ? `Orden de producción ${o.codigo}` : 'Orden de producción'}
      wide
      footer={
        o && (
          <>
            {canWrite && (o.estado === 'Borrador' || o.estado === 'Liberada') && (
              <button className="b b-red" style={{ marginRight: 'auto' }} onClick={() => modal.open(<CancelOrderModal orden={o} />)}>
                Cancelar orden
              </button>
            )}
            <CancelButton label="Cerrar" />
            {canWrite && o.estado === 'Borrador' && (
              <button
                className="b b-amber"
                disabled={!!busy}
                onClick={() => act('release', () => produccionApi.liberar(o.id), (x) => `${x.codigo} liberada: lista para iniciar en planta`, ['dashboard'])}
              >
                {busy === 'release' ? 'Liberando…' : 'Liberar a producción'}
              </button>
            )}
            {o.estado === 'Liberada' && canStart && (
              <button
                className="b b-amber"
                disabled={!!busy || faltantes.length > 0}
                title={faltantes.length ? 'Faltan materiales en bodega' : undefined}
                onClick={() =>
                  confirmar
                    ? act('start', () => produccionApi.iniciar(o.id), (x) => `${x.codigo} en proceso: materiales descargados por ${money(x.costoMateriales)}`, KEYS_STOCK)
                    : setConfirmar(true)
                }
              >
                {busy === 'start' ? 'Iniciando…' : confirmar ? '¿Descargar los materiales del inventario? Confirmar' : '▶ Iniciar producción'}
              </button>
            )}
            {o.estado === 'En proceso' && canWrite && (
              <button className="b b-amber" disabled={!pasosListos} title={pasosListos ? undefined : 'Registre primero todos los pasos de la ruta'} onClick={() => modal.open(<CompleteOrderModal orden={o} />)}>
                ✓ Terminar orden
              </button>
            )}
            {o.estado === 'Terminada' && lotePendiente && canQc && (
              <button className="b b-amber" onClick={() => modal.open(<InspectLotModal loteId={lotePendiente.id} volverA={{ ordenId: o.id }} />)}>
                Inspeccionar {lotePendiente.codigo}
              </button>
            )}
          </>
        )
      }
    >
      {error && !o ? (
        <ErrorState msg={error} onRetry={reload} />
      ) : !o ? (
        <ViewLoader text="Cargando orden…" />
      ) : (
        <>
          <div className="doc-head">
            <div>
              <div className="doc-title">
                {o.producto.nombre} <span className="mono muted-sm">{o.producto.sku}</span>
              </div>
              <div className="doc-meta">
                {cantidadCon(o.cantidad, o.producto.unidad)} planificadas · creada {fmtDateTime(o.fecha)}
                {o.creadaPor && ` por ${o.creadaPor}`}
              </div>
              <div className="doc-meta">
                {o.bom && (
                  <>
                    Lista de materiales <b className="mono">{o.bom.codigo}</b> v{o.bom.version}
                  </>
                )}
                {o.ruta && (
                  <>
                    {' '}
                    · ruta <b className="mono">{o.ruta.codigo}</b> {o.ruta.nombre}
                  </>
                )}
                {(o.inicioPlan || o.entrega) && (
                  <>
                    {' '}
                    · plan {fmtDate(o.inicioPlan)} → entrega {fmtDate(o.entrega)}
                  </>
                )}
              </div>
            </div>
            <EstadoTag estado={o.estado} />
          </div>

          <Flujo o={o} />

          <DocChain
            items={[
              { tipo: 'PRODUCCION', id: o.id, codigo: o.codigo, actual: true },
              ...o.lotes.map((l) => ({
                tipo: 'LOTE' as const,
                id: l.id,
                codigo: l.codigo,
                detalle: l.estado,
                onOpen: () => modal.open(<LotDetailModal loteId={l.id} />),
              })),
              ...(liberadas > 0 ? [{ tipo: 'MOVIMIENTO' as const, id: 'in', codigo: `+${liberadas} al inventario` }] : []),
            ]}
          />

          {o.estado === 'Cancelada' && (
            <div className="note note-danger" style={{ marginBottom: 12 }}>
              <span className="ic">⛔</span>
              <div>
                Orden cancelada {fmtDateTime(o.cancelada)}. Motivo: {o.motivoCancelacion || '—'}
              </div>
            </div>
          )}

          <div className="mini-kpis">
            <div>
              <span>Producidas</span>
              <b>{o.estado === 'Terminada' ? `${o.producida} / ${o.cantidad}` : `— / ${o.cantidad}`}</b>
              <small>{o.estado === 'Terminada' ? `${liberadas} liberadas · ${desechadas} scrap` : 'se registran al terminar'}</small>
            </div>
            <div>
              <span>Costo de materiales</span>
              <b>{money(o.costoMateriales || o.materiales.reduce((t, m) => t + m.planificado * m.componente.costo, 0))}</b>
              <small>
                {o.costoMateriales
                  ? `${money(o.costoMateriales / Math.max(1, o.producida || o.cantidad))} por unidad`
                  : 'estimado con el costo promedio actual'}
              </small>
            </div>
            <div>
              <span>Tiempo de ciclo</span>
              <b>{o.cicloHoras !== null ? fmtHoras(o.cicloHoras) : o.iniciada ? 'en curso' : '—'}</b>
              <small>{o.iniciada ? `inició ${fmtDateTime(o.iniciada)}` : `estándar ${fmtMinutos(o.pasos.reduce((t, p) => t + p.minutos, 0) * o.cantidad)}`}</small>
            </div>
          </div>

          <h4 className="section-title">Materiales (lista de materiales)</h4>
          {faltantes.length > 0 && o.estado !== 'Cancelada' && (
            <div className="note note-warn" style={{ marginBottom: 10 }}>
              <span className="ic">⚠️</span>
              <div>
                Faltan materiales en bodega para iniciar: {faltantes.map((m) => `${cantidadCon(m.faltante, m.componente.unidad)} de ${m.componente.sku}`).join(', ')}.
                {can('purchases:write') && (
                  <>
                    {' '}
                    <button
                      className="b b-out b-sm"
                      style={{ marginLeft: 6 }}
                      onClick={() =>
                        modal.open(
                          <PurchaseFormModal
                            preset={{ notas: `Materiales para la orden de producción ${o.codigo}`, lineas: faltantes.map((m) => ({ prod: m.componente.id, cant: m.faltante })) }}
                          />,
                        )
                      }
                    >
                      Comprar faltantes
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="tablewrap" style={{ marginBottom: 6 }}>
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th className="num">Requerido</th>
                  <th className="num">{o.iniciada ? 'Consumido' : 'En bodega'}</th>
                  <th className="num">Costo unit.</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {o.materiales.map((m) => {
                  const costo = m.consumido ? m.costoUnit : m.componente.costo;
                  return (
                    <tr key={m.componente.id}>
                      <td>
                        {m.componente.nombre} <span className="mono muted-sm">{m.componente.sku}</span>
                      </td>
                      <td className="num">{cantidadCon(m.planificado, m.componente.unidad)}</td>
                      <td className="num" style={m.faltante > 0 ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                        {o.iniciada ? cantidadCon(m.consumido, m.componente.unidad) : m.disponible}
                        {m.faltante > 0 && <div className="sub-num">faltan {m.faltante}</div>}
                      </td>
                      <td className="num">{money(costo)}</td>
                      <td className="num">{money(costo * m.planificado)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h4 className="section-title">Ruta de producción</h4>
          {o.pasos.length ? (
            <ol className="op-steps">
              {o.pasos.map((p) => (
                <li key={p.id} className={p.hecho ? 'done' : p.id === siguiente?.id ? 'next' : ''}>
                  <span className="seq" aria-hidden="true">
                    {p.hecho ? '✓' : p.secuencia}
                  </span>
                  <div className="txt">
                    <b>
                      {p.secuencia}. {p.nombre}
                    </b>
                    <div className="meta">
                      {p.centro || 'Sin centro de trabajo'} · estándar {fmtMinutos(p.minutos * o.cantidad)} ({p.minutos} min/u.)
                      {p.hecho && (
                        <>
                          {' '}
                          · hecho {fmtDateTime(p.fecha)}
                          {p.por && ` por ${p.por}`}
                        </>
                      )}
                    </div>
                  </div>
                  {p.id === siguiente?.id && canWrite ? (
                    <button
                      className="b b-green b-sm"
                      disabled={!!busy}
                      onClick={() => act(`step-${p.id}`, () => produccionApi.completarPaso(o.id, p.id), () => `Paso «${p.nombre}» registrado`)}
                    >
                      {busy === `step-${p.id}` ? 'Guardando…' : 'Marcar hecho'}
                    </button>
                  ) : (
                    <span className="muted-sm">{p.hecho ? 'Hecho' : 'Pendiente'}</span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="doc-meta">Esta orden no tiene ruta: se puede terminar sin registrar pasos.</p>
          )}

          <h4 className="section-title">Lotes y calidad</h4>
          {!o.lotes.length ? (
            <p className="doc-meta">El lote se crea al terminar la orden con las unidades producidas.</p>
          ) : (
            o.lotes.map((l) => (
              <div className="receipt" key={l.id}>
                <div className="receipt-h">
                  <b className="mono">{l.codigo}</b>
                  <span>
                    {fmtDateTime(l.fecha)} · {cantidadCon(l.cantidad, o.producto.unidad)} · {money(l.costoUnit)} c/u
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    <EstadoTag estado={l.estado} />
                  </span>
                </div>
                {l.inspecciones.length ? (
                  <ul className="receipt-items">
                    {l.inspecciones.map((i) => (
                      <li key={i.id}>
                        <span>
                          <b className="mono">{i.codigo}</b> {i.etapa === 'Inicial' ? 'Inspección' : 'Re-inspección'} de {i.inspeccionadas} u. ·{' '}
                          <EstadoTag estado={i.conforme ? 'Conforme' : 'No conforme'} />
                          {!i.conforme && (
                            <>
                              {' '}
                              {i.defectuosas} → {nombreDisposicion(i.disposicion)}
                              {i.defecto && <span className="muted-sm"> ({i.defecto})</span>}
                            </>
                          )}
                        </span>
                        <span className="muted-sm">
                          {fmtDateTime(i.fecha)} · {i.inspector}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="doc-meta">Pendiente de inspección de calidad: no entra al inventario hasta liberarse.</div>
                )}
              </div>
            ))
          )}

          {o.movimientos.length > 0 && (
            <>
              <h4 className="section-title">Movimientos de inventario</h4>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Producto</th>
                      <th className="num">Cant.</th>
                      <th className="num">Costo</th>
                      <th className="num">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.movimientos.map((m) => (
                      <tr key={m.id} title={m.nota}>
                        <td className="mono">{fmtDateTime(m.fecha)}</td>
                        <td>
                          <TipoMovTag tipo={m.tipo} />
                          {m.lote && <div className="sub-num mono">{m.lote}</div>}
                        </td>
                        <td>
                          {m.nombre} <span className="mono muted-sm">{m.sku}</span>
                        </td>
                        <td className="num">
                          {m.tipo === 'Salida' ? '−' : '+'}
                          {m.cantidad}
                        </td>
                        <td className="num">{money(m.costo)}</td>
                        <td className="num mono">
                          {m.antes} → {m.despues}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {o.notas && (
            <p className="doc-meta" style={{ marginTop: 10, whiteSpace: 'pre-line' }}>
              <b>Notas:</b> {o.notas}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

/** Etapas del flujo: la orden avanza Borrador → Liberada → En proceso → Terminada → Calidad. */
function Flujo({ o }: { o: OrdenProduccion }) {
  if (o.estado === 'Cancelada') return null;
  const idx = FLUJO.indexOf(o.estado as (typeof FLUJO)[number]);
  const calidadLista = o.estado === 'Terminada' && o.lotes.length > 0 && o.lotes.every((l) => l.estado === 'Liberado' || l.estado === 'Desechado');
  const etapas = [
    { t: 'Borrador', d: 'planificada' },
    { t: 'Liberada', d: fmtDate(o.liberadaEn) },
    { t: 'En proceso', d: o.iniciada ? 'materiales descargados' : 'consume la BOM' },
    { t: 'Terminada', d: o.terminada ? `${o.producida} u. en lote` : 'crea el lote' },
    { t: 'Calidad', d: calidadLista ? 'lote liberado' : 'conforme / no conforme' },
  ];
  return (
    <ol className="op-flow" aria-label="Avance de la orden">
      {etapas.map((e, i) => {
        const done = i < idx || (i === idx && o.estado === 'Terminada') || (i === 4 && calidadLista);
        const now = !done && (i === idx || (i === 4 && o.estado === 'Terminada'));
        return (
          <li key={e.t} className={done ? 'done' : now ? 'now' : ''} aria-current={now ? 'step' : undefined}>
            {done ? '✓ ' : ''}
            {e.t}
            <small>{e.d}</small>
          </li>
        );
      })}
    </ol>
  );
}
