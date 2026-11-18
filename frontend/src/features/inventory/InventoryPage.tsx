/* MÓDULO: INVENTARIO (RF-06/07/08/09) — costo promedio móvil */
import { KpiCard } from '../../components/cards/KpiCard';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { Tag, TipoMovTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { TipoMovimiento } from '../../types';
import { fmtDateTime, money } from '../../utils/format';
import { stockCritico } from '../dashboard/kpis';
import { MovementFormModal } from './MovementFormModal';

export function InventoryPage() {
  const { db } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const valor = db.inventarioValor || db.productos.reduce((a, p) => a + p.stock * p.costo, 0);
  const criticos = stockCritico(db).length;
  const abrir = (tipo: TipoMovimiento) => modal.open(<MovementFormModal tipo={tipo} />);

  return (
    <>
      <ViewHead
        title="Inventario"
        desc="Entradas, salidas y ajustes. El servidor recalcula el costo promedio móvil con cada entrada (RF-08)."
        actions={
          can('inventory:write') && (
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
          )
        }
      />
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Valor de inventario" val={money(valor)} sub={db.productos.length + ' SKU'} ic="◰" />
        <KpiCard lbl="Productos críticos" val={criticos} sub="requieren compra" ic="▼" tone={criticos ? 'warn' : 'good'} />
        <KpiCard lbl="Movimientos" val={db.movimientos.length} sub="más recientes" ic="⇅" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Existencias por producto</h3>
        <div className="tablewrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th className="num">Stock</th>
                <th className="num">Mínimo</th>
                <th className="num">Costo prom.</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {db.productos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.sku}</td>
                  <td>
                    {p.ic} {p.nombre}
                  </td>
                  <td className="num">{p.stock}</td>
                  <td className="num">{p.stockMin}</td>
                  <td className="num">{money(p.costo)}</td>
                  <td>{p.stock <= p.stockMin ? <Tag tone="t-red">Crítico</Tag> : <Tag tone="t-green">OK</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Bitácora de movimientos</h3>
        <div className="tablewrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Costo unit.</th>
                <th className="num">Stock final</th>
                <th>Referencia</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {!db.movimientos.length && <EmptyRow cols={8} msg="Sin movimientos" />}
              {db.movimientos.map((m) => (
                <tr key={m.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtDateTime(m.fecha)}</td>
                  <td>
                    <TipoMovTag tipo={m.tipo} />
                  </td>
                  <td>{m.prodN}</td>
                  <td className="num">
                    {m.tipo === 'Ajuste' ? (m.stockDespues >= m.stockAntes ? '+' : '-') : m.tipo === 'Salida' ? '-' : '+'}
                    {m.cant}
                  </td>
                  <td className="num">{m.costo ? money(m.costo) : '—'}</td>
                  <td className="num">{m.stockDespues}</td>
                  <td title={m.nota}>{m.ref || m.nota || '—'}</td>
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
