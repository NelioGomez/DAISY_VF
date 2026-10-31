/* MÓDULO: PRODUCCIÓN (entrega 2 — bloque manufacturero)
   Compra → recepción → orden de producción (consume la BOM) → pasos de la ruta → lote →
   control de calidad (conforme / no conforme: retrabajo, scrap o liberación) → inventario → venta.
   Los KPI salen del propio sistema (GET /dashboard/summary). */
import { useSearchParams } from 'react-router-dom';
import { KpiCard } from '../../components/cards/KpiCard';
import { Tabs } from '../../components/common/Tabs';
import { ViewHead } from '../../components/common/ViewHead';
import { useModal } from '../../components/modals/useModal';
import { useAuth, useData } from '../../store/hooks';
import { BomPanel } from './BomPanel';
import { LotsPanel } from './LotsPanel';
import { OrderFormModal } from './OrderFormModal';
import { OrdersPanel } from './OrdersPanel';
import { fmtHoras, pct } from './productionFormat';
import { RoutesPanel } from './RoutesPanel';

type Tab = 'ordenes' | 'lotes' | 'bom' | 'rutas';
const TABS: Tab[] = ['ordenes', 'lotes', 'bom', 'rutas'];

export function ProductionPage() {
  const { db } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'ordenes';
  const setTab = (t: Tab) => setParams(t === 'ordenes' ? {} : { tab: t }, { replace: true });
  const k = db.dashboard?.produccion ?? null;

  return (
    <>
      <ViewHead
        title="Producción"
        desc="Ensamble de productos con lista de materiales (BOM) y ruta. Al iniciar una orden se descargan sus componentes del inventario; al terminarla, las unidades forman un lote que entra al stock solo cuando calidad lo libera."
        actions={
          can('production:write') && (
            <button className="b b-amber" onClick={() => modal.open(<OrderFormModal />)}>
              + Nueva orden de producción
            </button>
          )
        }
      />

      {k && (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <KpiCard
            lbl="Rendimiento (yield)"
            val={pct(k.rendimiento)}
            sub={k.planificadas30 ? `${k.liberadasCalidad30} de ${k.planificadas30} u. planificadas, liberadas · 30 días` : 'sin órdenes terminadas en 30 días'}
            ic="◎"
            tone={k.rendimiento === null ? '' : k.rendimiento >= 95 ? 'good' : 'warn'}
          />
          <KpiCard
            lbl="No conformidad"
            val={pct(k.noConformidad)}
            sub={k.inspeccionadas30 ? `${k.noConformes30} de ${k.inspeccionadas30} u. inspeccionadas` : 'sin inspecciones en 30 días'}
            ic="✕"
            tone={k.noConformidad === null ? '' : k.noConformidad <= 5 ? 'good' : 'warn'}
          />
          <KpiCard
            lbl="Tiempo de ciclo"
            val={k.terminadas30 ? fmtHoras(k.cicloHoras) : '—'}
            sub={k.terminadas30 ? `promedio de ${k.terminadas30} orden(es) terminada(s)` : 'del inicio al término de la orden'}
            ic="◷"
          />
          <KpiCard
            lbl="Por inspeccionar"
            val={k.lotesPorInspeccionar}
            sub={`lote(s) · ${k.enProceso} OP en proceso · ${k.liberadas} por iniciar`}
            ic="▦"
            tone={k.lotesPorInspeccionar ? 'warn' : 'good'}
          />
        </div>
      )}

      <Tabs
        label="Secciones de producción"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'ordenes', label: 'Órdenes de producción', count: k ? k.liberadas + k.enProceso : undefined },
          { id: 'lotes', label: 'Lotes y calidad', count: k?.lotesPorInspeccionar },
          { id: 'bom', label: 'Listas de materiales' },
          { id: 'rutas', label: 'Rutas' },
        ]}
      />

      {tab === 'ordenes' && <OrdersPanel />}
      {tab === 'lotes' && <LotsPanel />}
      {tab === 'bom' && <BomPanel />}
      {tab === 'rutas' && <RoutesPanel />}
    </>
  );
}
