/* MÓDULO: REPORTES Y KPIs (RF-18/19/20/23)
   Usa el resumen del dashboard y el reporte "sales-by-period" del servidor,
   que ya calcula costo y margen con el costo promedio al momento de vender. */
import { useEffect, useState } from 'react';
import { KpiCard } from '../../components/cards/KpiCard';
import { BarChart } from '../../components/charts/BarChart';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyState } from '../../components/feedback/Empty';
import { Tag } from '../../components/tables/Tag';
import { api } from '../../services/api/client';
import { useAuth, useData } from '../../store/hooks';
import { money } from '../../utils/format';
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

interface PeriodRow {
  total: number;
  cost: number;
  margin: number;
}

export function ReportsPage() {
  const { db } = useData();
  const { can } = useAuth();
  const exportVentas = useExportVentas();
  const exportProductos = useExportProductos();
  const [margen, setMargen] = useState<number | null>(null);
  const d = db.dashboard;

  useEffect(() => {
    let alive = true;
    api
      .get<{ rows: PeriodRow[] }>('/reports/sales-by-period', { groupBy: 'month', from: '2000-01-01' })
      .then((r) => alive && setMargen((r.rows ?? []).reduce((a, x) => a + Number(x.margin ?? 0), 0)))
      .catch(() => alive && setMargen(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!d) return <div className="card"><EmptyState msg="Sin datos de reportes" /></div>;

  const porDia = d.ventasPorDia.slice(-14).map((x) => ({
    label: new Date(x.dia + 'T00:00:00').toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit' }),
    value: x.total,
  }));
  const top = d.topProductos.slice(0, 6).map((p) => ({ label: p.nombre.length > 12 ? p.nombre.slice(0, 12) + '…' : p.nombre, value: p.unidades }));
  const totalMetodos = d.porMetodo.reduce((a, b) => a + b.total, 0) || 1;

  return (
    <>
      <ViewHead
        title="Reportes y KPIs"
        desc="Indicadores de ventas, márgenes, rotación y disponibilidad, calculados por el servidor."
        actions={
          <>
            {can('sales:read') && (
              <button className="b b-out" onClick={exportVentas}>
                ⬇ Ventas
              </button>
            )}
            {(can('products:read') || can('inventory:read')) && (
              <button className="b b-out" onClick={exportProductos}>
                ⬇ Inventario
              </button>
            )}
          </>
        }
      />
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Ventas acumuladas" val={money(d.ventasAcumuladas.total)} sub={d.ventasAcumuladas.facturas + ' facturas'} ic="◩" />
        <KpiCard lbl="Margen bruto" val={margen === null ? '—' : money(margen)} sub="ventas − costo promedio" ic="◔" tone="good" />
        {d.secciones.cxc ? (
          <KpiCard lbl="Cuentas por cobrar" val={money(d.cxc.total)} sub={`${money(d.cxc.montoVencido)} vencido`} ic="◷" tone={d.cxc.total > 0 ? 'warn' : 'good'} />
        ) : (
          <KpiCard lbl="Ventas (30 días)" val={money(d.ventas30.total)} sub={d.ventas30.facturas + ' facturas'} ic="⛽" />
        )}
        {d.secciones.inventario ? (
          <KpiCard lbl="Valor de inventario" val={money(d.inventario.valor)} sub={d.inventario.productos + ' productos activos'} ic="◰" />
        ) : (
          <KpiCard lbl="Facturas emitidas" val={d.ventasAcumuladas.facturas} sub="acumulado" ic="◧" />
        )}
      </div>

      <div className="split">
        <div className="card">
          <h3>Ventas por día (14 días)</h3>
          <BarChart data={porDia} />
        </div>
        <div className="card">
          <h3>Productos más vendidos (unid.)</h3>
          {top.length ? <BarChart data={top} /> : <EmptyState msg="Sin datos" />}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Ventas por método de pago</h3>
          {d.porMetodo.length ? (
            d.porMetodo.map((m) => {
              const pct = Math.round((m.total / totalMetodos) * 100);
              return (
                <div key={m.metodo} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <b>{m.metodo}</b>
                    <span className="mono">
                      {money(m.total)} ({pct}%)
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
          {!d.secciones.inventario ? (
            <EmptyState msg="Su rol no tiene acceso al inventario" ic="◰" />
          ) : d.inventario.reponer.length ? (
            <div className="tablewrap" style={{ border: 'none' }}>
              <table>
                <tbody>
                  {d.inventario.reponer.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="mono">{p.sku}</td>
                      <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                        {p.stock} / {p.stockMin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState msg="Inventario saludable" ic="✓" />
          )}
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
