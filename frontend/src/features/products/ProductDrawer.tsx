/* Ficha detallada de producto (mejora n.° 3) en un panel lateral (n.° 33).
   Reúne datos maestros, existencias, rotación, movimientos en línea de tiempo (n.° 16),
   ventas recientes, proveedores, compras en camino e historial de precios. Cada sección
   aparece solo si el rol puede verla (el servidor la envía en null si no). */
import { ErrorState } from '../../components/feedback/ErrorState';
import { useEffect, useState } from 'react';
import { DocChip } from '../../components/common/DocChain';
import { Icon } from '../../components/common/Icon';
import { ProductImage } from '../../components/common/ProductImage';
import { Tabs, type TabItem } from '../../components/common/Tabs';
import { EmptyState } from '../../components/feedback/Empty';
import { ViewLoader } from '../../components/feedback/FullScreenLoader';
import { Drawer } from '../../components/modals/Drawer';
import { useModal } from '../../components/modals/useModal';
import { Tag, type TagTone } from '../../components/tables/Tag';
import { subscribeRealtime } from '../../services/realtime/realtime';
import { useAuth, useData } from '../../store/hooks';
import type { FichaProducto } from '../../types';
import { ago, fmtDate, fmtDateTime, money } from '../../utils/format';
import { plazoGarantia } from '../../utils/warranty';
import { useOpenDocument } from '../documents/useOpenDocument';
import { AdjustmentFormModal } from '../inventory/AdjustmentFormModal';
import { costIn } from '../purchases/purchaseFormat';
import { ROTACION } from '../inventory/rotation';
import { PriceModal } from './PriceModal';
import { ProductFormModal } from './ProductFormModal';

type Tab = 'resumen' | 'movimientos' | 'ventas' | 'proveedores' | 'precios';


const STOCK_TONE: Record<FichaProducto['estadoStock'], { tone: TagTone; ic: string }> = {
  Agotado: { tone: 't-red', ic: '✕' },
  Bajo: { tone: 't-amber', ic: '▼' },
  Disponible: { tone: 't-green', ic: '✓' },
};

export function ProductDrawer({ productoId }: { productoId: string }) {
  const { fichaProducto } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const doc = useOpenDocument();
  const [f, setF] = useState<FichaProducto | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('resumen');

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void fichaProducto(productoId).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setF(r.data);
        setError('');
      }
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [fichaProducto, productoId, version]);

  // Se actualiza sola si alguien vende, recibe o ajusta productos mientras está abierta.
  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (['sales', 'inventory', 'purchases', 'products'].includes(e.module)) setVersion((v) => v + 1);
      }),
    [],
  );

  if (error)
    return (
      <Drawer title="Producto">
        <ErrorState msg={error} onRetry={() => setVersion((n) => n + 1)} />
      </Drawer>
    );
  if (!f)
    return (
      <Drawer title="Producto">
        <ViewLoader text="Cargando ficha…" />
      </Drawer>
    );

  const p = f.producto;
  const margen = p.precio > 0 && p.costo > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 1000) / 10 : null;
  const st = STOCK_TONE[f.estadoStock];
  const tabs: TabItem<Tab>[] = [
    { id: 'resumen', label: 'Resumen' },
    ...(f.movimientos ? [{ id: 'movimientos' as const, label: 'Movimientos', count: f.movimientos.length }] : []),
    ...(f.ventas ? [{ id: 'ventas' as const, label: 'Ventas', count: f.ventas.length }] : []),
    ...(f.proveedores ? [{ id: 'proveedores' as const, label: 'Proveedores', count: f.proveedores.length }] : []),
    ...(f.precios ? [{ id: 'precios' as const, label: 'Precios' }] : []),
  ];

  return (
    <Drawer
      title={p.nombre}
      subtitle={
        <>
          <span className="mono">{p.sku}</span>
          {p.marca && ` · ${p.marca}`}
          {p.categoria && ` · ${p.categoria}`}
        </>
      }
      footer={
        <>
          {can('inventory:write') && (
            <button className="b b-out b-sm" onClick={() => modal.open(<AdjustmentFormModal productoId={p.id} />)}>
              ⚖ Ajustar
            </button>
          )}
          {can('prices:write') && (
            <button className="b b-out b-sm" onClick={() => modal.open(<PriceModal producto={p} />)}>
              Precio
            </button>
          )}
          {can('products:write') && (
            <button className="b b-amber b-sm" onClick={() => modal.open(<ProductFormModal producto={p} />)}>
              Editar
            </button>
          )}
        </>
      }
    >
      <div className="drawer-photo">
        <ProductImage src={p.imagen} size={88} fallback={p.ic} alt={p.imagen ? `Foto de ${p.nombre}` : ''} />
        <div>
          <div className="tag-row">
            <Tag tone={st.tone}>
              <span aria-hidden="true">{st.ic}</span> {f.estadoStock}
            </Tag>
            {f.stats && (
              <Tag tone={ROTACION[f.stats.rotacion].tone}>
                <span aria-hidden="true">{ROTACION[f.stats.rotacion].ic}</span> {ROTACION[f.stats.rotacion].txt}
              </Tag>
            )}
            {p.garantiaDias ? (
              <Tag tone="t-blue">
                <Icon name="shield-check" size={12} strokeWidth={2.4} /> Garantía {plazoGarantia(p.garantiaDias)}
              </Tag>
            ) : (
              <Tag tone="t-gray">Sin garantía</Tag>
            )}
            {!p.activo && <Tag tone="t-gray">Inactivo</Tag>}
          </div>
          {p.descripcion && p.descripcion !== p.nombre && <p className="doc-meta">{p.descripcion}</p>}
        </div>
      </div>

      <div className="mini-kpis">
        <div>
          <span>Stock</span>
          <b>{p.stock}</b>
          <small>
            bodega {p.stockBodega} · sucursal {p.stockSucursal}
          </small>
          <small>
            mín. {p.stockMin}
            {p.stockMax !== null && ` · máx. ${p.stockMax}`}
          </small>
        </div>
        <div>
          <span>Costo promedio</span>
          <b>{money(p.costo)}</b>
          <small>sale de compras y entradas</small>
        </div>
        <div>
          <span>Precio vigente</span>
          <b>{p.precio > 0 ? money(p.precio) : '—'}</b>
          <small>{margen !== null ? `margen ${margen}%` : 'sin precio comercial'}</small>
        </div>
      </div>

      <Tabs<Tab> label="Secciones de la ficha" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'resumen' && (
        <div className="drawer-section">
          {f.stats ? (
            <dl className="facts">
              <dt>Vendidas (30 / 90 días)</dt>
              <dd>
                {f.stats.vendidas30} / {f.stats.vendidas90} u.
              </dd>
              {f.stats.consumidas90 > 0 && (
                <>
                  <dt>Consumidas en producción (90 días)</dt>
                  <dd>{f.stats.consumidas90} u. (cuentan para la rotación)</dd>
                </>
              )}
              <dt>Días de inventario</dt>
              <dd>{f.stats.diasCobertura === null ? 'sin ventas recientes' : `≈ ${f.stats.diasCobertura} días al ritmo actual`}</dd>
              <dt>Última venta</dt>
              <dd>{f.stats.ultimaVenta ? `${fmtDate(f.stats.ultimaVenta)} (${ago(f.stats.ultimaVenta)})` : '—'}</dd>
              <dt>Ingresos y margen (90 días)</dt>
              <dd>
                {money(f.stats.ingresos90)} · margen {money(f.stats.margen90)}
              </dd>
            </dl>
          ) : (
            <p className="doc-meta">Las estadísticas de venta requieren acceso a Ventas.</p>
          )}
          {f.enCamino && (
            <>
              <h4 className="section-title">En camino</h4>
              {f.enCamino.compras.length ? (
                <ul className="plain-list">
                  {f.enCamino.compras.map((c) => (
                    <li key={c.id}>
                      <DocChip tipo="COMPRA" codigo={c.codigo} onOpen={() => doc.open({ tipo: 'COMPRA', id: c.id, codigo: c.codigo })} /> {c.pendiente} u. de {c.proveedor}
                      {c.esperada && <span className="muted-sm"> · llega {fmtDate(c.esperada)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="doc-meta">No hay compras pendientes de recibir.</p>
              )}
            </>
          )}
          {p.descripcion && (
            <>
              <h4 className="section-title">Descripción</h4>
              <p className="doc-meta">{p.descripcion}</p>
            </>
          )}
        </div>
      )}

      {tab === 'movimientos' && f.movimientos && (
        <div className="drawer-section">
          {!f.movimientos.length ? (
            <EmptyState msg="Sin movimientos" ic="⇅" />
          ) : (
            <ol className="timeline" aria-label="Movimientos del producto, del más reciente al más antiguo">
              {f.movimientos.map((m) => {
                const signo = m.tipo === 'Ajuste' ? (m.stockDespues >= m.stockAntes ? '+' : '−') : m.tipo === 'Salida' ? '−' : '+';
                return (
                  <li key={m.id} className={`tl-${m.tipo === 'Entrada' ? 'in' : m.tipo === 'Salida' ? 'out' : 'adj'}`}>
                    <div className="tl-head">
                      <b>
                        {m.tipo} {signo}
                        {m.cant}
                      </b>
                      <span className="mono">
                        {m.stockAntes} → {m.stockDespues}
                      </span>
                    </div>
                    <div className="tl-meta">
                      {fmtDateTime(m.fecha)} · @{m.resp} · {m.ubicacion}
                      {m.costo !== null && ` · ${money(m.costo)} c/u`}
                      {m.proveedor && ` · ${m.proveedor}`}
                    </div>
                    {m.origen ? (
                      <DocChip
                        tipo={m.origen.tipo}
                        codigo={m.origen.codigo}
                        detalle={m.origen.lote}
                        onOpen={doc.canOpen(m.origen) ? () => doc.open(m.origen!) : undefined}
                      />
                    ) : (
                      (m.ref || m.nota) && <div className="tl-meta">{[m.ref, m.nota].filter(Boolean).join(' · ')}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {tab === 'ventas' && f.ventas && (
        <div className="drawer-section">
          {!f.ventas.length ? (
            <EmptyState msg="Sin ventas registradas" ic="▧" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Cliente</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio</th>
                </tr>
              </thead>
              <tbody>
                {f.ventas.map((v) => (
                  <tr key={v.ventaId}>
                    <td>
                      <DocChip tipo="VENTA" codigo={v.factura} detalle={fmtDate(v.fecha)} onOpen={() => doc.open({ tipo: 'VENTA', id: v.ventaId, codigo: v.factura })} />
                      {v.anulada && <Tag tone="t-gray">Anulada</Tag>}
                    </td>
                    <td>{v.cliente}</td>
                    <td className="num">{v.cant}</td>
                    <td className="num">{money(v.precio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'proveedores' && f.proveedores && (
        <div className="drawer-section">
          {!f.proveedores.length ? (
            <EmptyState msg="Aún no tiene proveedores registrados: se agregan al recibir compras o registrar entradas con proveedor" ic="◨" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th className="num">Último costo</th>
                  <th className="num">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {f.proveedores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.preferente && (
                        <span title="Proveedor preferente" aria-label="Preferente">
                          ★{' '}
                        </span>
                      )}
                      {s.nombre}
                      {s.pais && <span className="muted-sm"> · {s.pais}</span>}
                    </td>
                    <td className="num">{s.ultimoCosto !== null ? costIn(s.ultimoCosto, s.moneda) : '—'}</td>
                    <td className="num">{s.plazo !== null ? `${s.plazo} d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'precios' && f.precios && (
        <div className="drawer-section">
          {!f.precios.length ? (
            <EmptyState msg="Todavía no tiene precio comercial" ic="₡" />
          ) : (
            <ul className="plain-list">
              {f.precios.map((h) => (
                <li key={h.id}>
                  <b className="mono">{money(h.precio)}</b> {h.hasta ? <span className="muted-sm">hasta {fmtDate(h.hasta)}</span> : <Tag tone="t-green">Vigente</Tag>}
                  <div className="muted-sm">
                    Desde {fmtDateTime(h.desde)} · {h.usuario} · {h.motivo}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  );
}
