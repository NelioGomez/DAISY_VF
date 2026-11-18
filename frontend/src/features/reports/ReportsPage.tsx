/* MÓDULO: REPORTES Y KPIs (RF-18/19/20/23) */
import { KpiCard } from '../../components/cards/KpiCard';
import { BarChart } from '../../components/charts/BarChart';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyState } from '../../components/feedback/Empty';
import { Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import { money } from '../../utils/format';
import { MiniCritico } from '../dashboard/MiniTables';
import { stockCritico, totalCxC, ventasPorDia } from '../dashboard/kpis';
import { useExportProductos } from '../products/useExportProductos';
import { useExportVentas } from '../sales/useExportVentas';

const KPIS_MONITOREO: Array<[string, string, string, string]> = [
  ['KPI-01', 'Tiempo de respuesta', '< 2 seg', 'Técnico'],
  ['KPI-02', 'Disponibilidad mensual', '>= 99%', 'Técnico'],
  ['KPI-04', 'Backups exitosos', '100%', 'Técnico'],
  ['KPI-06', 'Ventas mensuales', 'Crecimiento', 'Comercial'],
  ['KPI-07', 'Margen por categoría', 'Monitorear', 'Financiero'],
  ['KPI-08', 'CxC vencidas', 'Reducir', 'Financiero'],
];

export function ReportsPage() {
  const { db } = useData();
  const exportVentas = useExportVentas();
  const exportProductos = useExportProductos();

  const totalVentas = db.ventas.reduce((a, x) => a + x.total, 0);
  const margen = db.ventas.reduce(
    (a, v) => a + v.items.reduce((s, it) => {
      const p = db.productos.find((x) => x.id === it.prod);
      return s + (it.precio - (p ? p.costo : 0)) * it.cant;
    }, 0),
    0,
  );
  const cxc = totalCxC(db);

  const vendidos: Record<string, number> = {};
  db.ventas.forEach((v) => v.items.forEach((it) => (vendidos[it.prodN] = (vendidos[it.prodN] || 0) + it.cant)));
  const top = Object.entries(vendidos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label: label.length > 12 ? label.slice(0, 12) + '…' : label, value }));

  const porMetodo: Record<string, number> = {};
  db.ventas.forEach((v) => (porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + v.total));
  const totalMetodos = Object.values(porMetodo).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <ViewHead
        title="Reportes y KPIs"
        desc="Indicadores de ventas, márgenes, rotación y disponibilidad — con exportación a CSV."
        actions={
          <>
            <button className="b b-out" onClick={exportVentas}>
              ⬇ Ventas
            </button>
            <button className="b b-out" onClick={exportProductos}>
              ⬇ Inventario
            </button>
          </>
        }
      />
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Ventas acumuladas" val={money(totalVentas)} sub={db.ventas.length + ' facturas'} ic="◩" />
        <KpiCard lbl="Margen bruto" val={money(margen)} sub="precio − costo" ic="◔" tone="good" />
        <KpiCard lbl="Cuentas por cobrar" val={money(cxc)} sub="pendiente" ic="◷" tone={cxc > 0 ? 'warn' : 'good'} />
        <KpiCard lbl="Disponibilidad" val=">= 99%" sub="uptime objetivo" ic="◉" tone="good" />
      </div>

      <div className="split">
        <div className="card">
          <h3>Ventas por día (14 días)</h3>
          <BarChart data={ventasPorDia(db, 14)} />
        </div>
        <div className="card">
          <h3>Productos más vendidos (unid.)</h3>
          {top.length ? <BarChart data={top} /> : <EmptyState msg="Sin datos" />}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Ventas por método de pago</h3>
          {Object.keys(porMetodo).length ? (
            Object.entries(porMetodo).map(([k, val]) => {
              const pct = Math.round((val / totalMetodos) * 100);
              return (
                <div key={k} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <b>{k}</b>
                    <span className="mono">
                      {money(val)} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 9, background: 'var(--panel)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,var(--amber),var(--amber-deep))' }} />
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState msg="Sin datos" />
          )}
        </div>
        <div className="card">
          <h3>Inventario crítico (reabastecer)</h3>
          <MiniCritico productos={stockCritico(db)} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>KPIs de monitoreo del sistema (Sección 15)</h3>
        <div className="tablewrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Indicador</th>
                <th>Meta</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {KPIS_MONITOREO.map((r) => (
                <tr key={r[0]}>
                  <td className="mono">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="mono">{r[2]}</td>
                  <td>
                    <Tag>{r[3]}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
