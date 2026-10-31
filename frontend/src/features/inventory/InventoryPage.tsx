/* MÓDULO: INVENTARIO (RF-06/07/08/09) — costo promedio móvil.
   Cada movimiento muestra su documento de origen (factura, recepción de compra u orden de
   producción con su lote) y se puede abrir. */
import { Link } from 'react-router-dom';
import { KpiCard } from '../../components/cards/KpiCard';
import { DocChip } from '../../components/common/DocChain';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { StockTag, TipoMovTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { TipoMovimiento } from '../../types';
import { fmtDateTime, money } from '../../utils/format';
import { stockCritico } from '../dashboard/kpis';
import { useOpenDocument } from '../documents/useOpenDocument';
import { PriceModal } from '../products/PriceModal';
import { ProductDrawer } from '../products/ProductDrawer';
import { MovementFormModal } from './MovementFormModal';

export function InventoryPage() {
  const { db } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const doc = useOpenDocument();
  const valor = db.inventarioValor || db.productos.reduce((a, p) => a + p.stock * p.costo, 0);
  const criticos = stockCritico(db).length;
  const abrir = (tipo: TipoMovimiento) => modal.open(<MovementFormModal tipo={tipo} />);
  const ficha = (id: string) => modal.open(<ProductDrawer productoId={id} />);

  return (
    <>
      <ViewHead
        title="Inventario"
        desc="Entradas, salidas y ajustes. El servidor recalcula el costo promedio móvil con cada entrada (RF-08). Las compras recibidas generan sus entradas solas."
        actions={
          <>
            {can('purchases:read') && (
              <Link className="b b-out" to="/app/compras?tab=reabastecimiento">
                ⇩ Reabastecer {criticos > 0 && <span className="pill-count">{criticos}</span>}
              </Link>
            )}
            {can('inventory:write') && (
              <>
                <button className="b b-out" onClick={() => abrir('Entrada')}>
                  ↧ Entrada
                </button>
                <button className="b b-out" onClick={() => abrir('Salida')}>
                  ↥ Salida
                </button>
                <button className="b b-amber" onClick={() => abrir('Ajuste')}>
                  ⚖ Ajuste
                </button>
              </>
            )}
          </>
        }
      />
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Valor de inventario" val={money(valor)} sub={db.productos.length + ' SKU'} ic="◰" />
        <KpiCard lbl="Productos críticos" val={criticos} sub="requieren compra" ic="▼" tone={criticos ? 'warn' : 'good'} />
        <KpiCard lbl="Movimientos" val={db.movimientos.length} sub="más recientes" ic="⇅" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Existencias por producto</h3>
        <div className="tablewrap tall" style={{ border: 'none' }}>
          <table className="sticky-head">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th className="num">Stock</th>
                <th className="num">Mínimo</th>
                <th className="num">Costo prom.</th>
                <th className="num">Precio</th>
                <th>Estado</th>
                {can('prices:write') && <th />}
              </tr>
            </thead>
            <tbody>
              {db.productos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.sku}</td>
                  <td>
                    <button className="link-btn" onClick={() => ficha(p.id)} title="Ver ficha del producto">
                      {p.ic} {p.nombre}
                    </button>
                  </td>
                  <td className="num">{p.stock}</td>
                  <td className="num">{p.stockMin}</td>
                  <td className="num">{money(p.costo)}</td>
                  <td className="num">{p.precio > 0 ? money(p.precio) : <span style={{ color: 'var(--muted)' }}>sin precio</span>}</td>
                  <td>
                    <StockTag stock={p.stock} min={p.stockMin} />
                  </td>
                  {can('prices:write') && (
                    <td>
                      <button className="b b-out b-sm" onClick={() => modal.open(<PriceModal producto={p} />)}>
                        Precio
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Bitácora de movimientos</h3>
        <div className="tablewrap tall" style={{ border: 'none' }}>
          <table className="sticky-head">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Costo unit.</th>
                <th className="num">Stock final</th>
                <th>Documento / referencia</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {!db.movimientos.length && <EmptyRow cols={8} msg="Sin movimientos" />}
              {db.movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {fmtDateTime(m.fecha)}
                  </td>
                  <td>
                    <TipoMovTag tipo={m.tipo} />
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => ficha(m.prod)}>
                      {m.prodN}
                    </button>
                  </td>
                  <td className="num">
                    {m.tipo === 'Ajuste' ? (m.stockDespues >= m.stockAntes ? '+' : '-') : m.tipo === 'Salida' ? '-' : '+'}
                    {m.cant}
                  </td>
                  <td className="num">{m.costo ? money(m.costo) : '—'}</td>
                  <td className="num">{m.stockDespues}</td>
                  <td title={m.nota}>
                    {m.origen ? (
                      <DocChip tipo={m.origen.tipo} codigo={m.origen.codigo} detalle={m.origen.lote} onOpen={doc.canOpen(m.origen) ? () => doc.open(m.origen!) : undefined} />
                    ) : (
                      m.ref || m.nota || '—'
                    )}
                  </td>
                  <td className="mono">@{m.resp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
