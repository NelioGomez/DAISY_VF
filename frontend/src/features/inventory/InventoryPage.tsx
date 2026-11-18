/* MÓDULO: INVENTARIO (RF-06/07/08/09) — costo promedio móvil.
   Existencias repartidas entre la Bodega principal y la Sucursal con traslados (mejora n.° 23),
   kardex paginado y filtrado en el servidor (n.° 18-20), rotación y días de inventario (n.° 11-12).
   Cada movimiento muestra dónde ocurrió y su documento de origen, y se puede abrir.
   Sin entradas ni salidas manuales (mejora n.° 57): llegan por compras, ventas y producción; aquí
   solo se registran traslados y ajustes con motivo. */
import { Link, useSearchParams } from 'react-router-dom';
import { KpiCard } from '../../components/cards/KpiCard';
import { Tabs } from '../../components/common/Tabs';
import { ViewHead } from '../../components/common/ViewHead';
import { useModal } from '../../components/modals/useModal';
import { useAuth, useData } from '../../store/hooks';
import { money } from '../../utils/format';
import { stockCritico } from '../dashboard/kpis';
import { AdjustmentFormModal } from './AdjustmentFormModal';
import { MovementsPanel } from './MovementsPanel';
import { RotationPanel } from './RotationPanel';
import { StockPanel } from './StockPanel';
import { TransferFormModal } from './TransferFormModal';
import { TransfersPanel } from './TransfersPanel';

type Tab = 'existencias' | 'movimientos' | 'traslados' | 'rotacion';
const TABS: Tab[] = ['existencias', 'movimientos', 'traslados', 'rotacion'];

export function InventoryPage() {
  const { db } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'existencias';
  const setTab = (t: Tab) => setParams(t === 'existencias' ? {} : { tab: t }, { replace: true });

  const activos = db.productos.filter((p) => p.activo);
  const valor = db.inventarioValor || activos.reduce((a, p) => a + p.stock * p.costo, 0);
  const bodega = activos.reduce((a, p) => ({ u: a.u + p.stockBodega, v: a.v + p.stockBodega * p.costo }), { u: 0, v: 0 });
  const sucursal = activos.reduce((a, p) => ({ u: a.u + p.stockSucursal, v: a.v + p.stockSucursal * p.costo }), { u: 0, v: 0 });
  const sinSucursal = activos.filter((p) => p.stock > 0 && p.stockSucursal === 0).length;
  const criticos = stockCritico(db).length;

  return (
    <>
      <ViewHead
        title="Inventario"
        desc="Existencias de la Bodega principal y la Sucursal. Las entradas llegan al recibir compras y las salidas con las ventas y la producción; aquí se trasladan existencias y se ajustan por conteo. El costo promedio móvil se recalcula con cada recepción (RF-08) y las ventas salen primero de la sucursal y, si no alcanza, de la bodega."
        actions={
          <>
            {can('purchases:read') && (
              <Link className="b b-out" to="/app/compras?tab=reabastecimiento">
                ⇩ Reabastecer {criticos > 0 && <span className="pill-count">{criticos}</span>}
              </Link>
            )}
            {can('inventory:write') && (
              <>
                <button className="b b-out" onClick={() => modal.open(<TransferFormModal />)}>
                  ⇄ Trasladar
                </button>
                <button className="b b-amber" onClick={() => modal.open(<AdjustmentFormModal />)}>
                  ⚖ Ajuste
                </button>
              </>
            )}
          </>
        }
      />
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Valor de inventario" val={money(valor)} sub={`${activos.length} productos activos`} ic="◰" />
        <KpiCard lbl="Bodega principal" val={`${bodega.u.toLocaleString('es-NI')} u.`} sub={money(bodega.v)} ic="▤" />
        <KpiCard
          lbl="Sucursal principal"
          val={`${sucursal.u.toLocaleString('es-NI')} u.`}
          sub={sinSucursal ? `${money(sucursal.v)} · ${sinSucursal} producto(s) solo en bodega` : money(sucursal.v)}
          ic="⊞"
        />
        <KpiCard lbl="Productos críticos" val={criticos} sub="en o bajo el mínimo" ic="▼" tone={criticos ? 'warn' : 'good'} />
      </div>

      <Tabs
        label="Secciones de inventario"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'existencias', label: 'Existencias' },
          { id: 'movimientos', label: 'Movimientos' },
          { id: 'traslados', label: 'Traslados' },
          { id: 'rotacion', label: 'Rotación' },
        ]}
      />

      {tab === 'existencias' && <StockPanel />}
      {tab === 'movimientos' && <MovementsPanel />}
      {tab === 'traslados' && <TransfersPanel />}
      {tab === 'rotacion' && <RotationPanel />}
    </>
  );
}
