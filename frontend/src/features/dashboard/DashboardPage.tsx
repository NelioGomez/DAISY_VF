/* MÓDULO: DASHBOARD (RF-20 / KPIs) — datos de GET /dashboard/summary. */
import { KpiCard } from '../../components/cards/KpiCard';
import { BarChart } from '../../components/charts/BarChart';
import { EmptyState } from '../../components/feedback/Empty';
import { EstadoTag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import type { DashboardResumen } from '../../types';
import { money } from '../../utils/format';

const SEVERITY: Record<string, { ic: string; bg: string; col: string }> = {
  critical: { ic: '▼', bg: 'var(--red-soft)', col: '#b32a20' },
  warning: { ic: '◷', bg: '#fff2d6', col: '#9a6500' },
  info: { ic: '◫', bg: 'var(--blue-soft)', col: '#205283' },
};

export function DashboardPage() {
  const { db } = useData();
  const d = db.dashboard;
  if (!d)
    return (
      <div className="card">
        <EmptyState msg="El resumen no está disponible para su rol." ic="▦" />
      </div>
    );

  const sec = d.secciones;
  const kpis = [
    sec.ventas && <KpiCard key="v" lbl="Ventas (30 días)" val={money(d.ventas30.total)} sub={d.ventas30.facturas + ' facturas'} ic="⛽" />,
    sec.inventario && (
      <KpiCard
        key="s"
        lbl="Stock crítico"
        val={d.inventario.criticos}
        sub={`productos ≤ mínimo · ${d.inventario.agotados} agotados`}
        ic="▼"
        tone={d.inventario.criticos ? 'warn' : 'good'}
      />
    ),
    sec.inventario && !sec.ventas && (
      <KpiCard key="iv" lbl="Valor de inventario" val={money(d.inventario.valor)} sub={d.inventario.productos + ' productos activos'} ic="◰" />
    ),
    sec.cxc && (
      <KpiCard
        key="c"
        lbl="Cuentas por cobrar"
        val={money(d.cxc.total)}
        sub={`${d.cxc.facturas} facturas · ${d.cxc.vencidas} vencidas`}
        ic="◷"
        tone={d.cxc.total > 0 ? 'warn' : 'good'}
      />
    ),
    sec.ordenes && (
      <KpiCard
        key="o"
        lbl="Órdenes OPI abiertas"
        val={d.ordenesAbiertas}
        sub={sec.cotizaciones ? `${d.cotizaciones.pendientes} cotizaciones pend.` : 'registradas, asignadas o en proceso'}
        ic="▩"
      />
    ),
    sec.cotizaciones && !sec.ordenes && (
      <KpiCard key="q" lbl="Cotizaciones pendientes" val={d.cotizaciones.pendientes} sub={`${d.cotizaciones.aprobadasSinVenta} aprobadas sin venta`} ic="▥" />
    ),
    ...(sec.ordenes && !sec.ventas
      ? d.ordenesPorEstado.filter((x) => x.estado !== 'Completada').map((x) => <KpiCard key={x.estado} lbl={x.estado} val={x.cantidad} sub="órdenes" ic="▩" />)
      : []),
  ].filter(Boolean);

  const porDia = d.ventasPorDia.slice(-14).map((x) => ({
    label: new Date(x.dia + 'T00:00:00').toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit' }),
    value: x.total,
  }));

  return (
    <>
      <div className={`grid cols-${Math.min(4, Math.max(2, kpis.length))}`} style={{ marginBottom: 16 }}>
        {kpis}
      </div>

      <div className="split">
        {sec.ventas ? (
          <div className="card">
            <h3>Ventas diarias — últimos 14 días</h3>
            <BarChart data={porDia} />
          </div>
        ) : sec.ordenes ? (
          <div className="card">
            <h3>Órdenes de servicio por estado</h3>
            <BarChart data={d.ordenesPorEstado.map((x) => ({ label: x.estado, value: x.cantidad }))} />
          </div>
        ) : sec.inventario ? (
          <StockCritico d={d} />
        ) : (
          <div className="card">
            <EmptyState msg="Sin indicadores para su rol" ic="▦" />
          </div>
        )}
        <div className="card">
          <h3>Alertas</h3>
          {d.alertas.length ? (
            d.alertas.map((a, i) => {
              const s = SEVERITY[a.severidad] ?? SEVERITY.info;
              return (
                <div className="alert-li" key={a.tipo + i}>
                  <div className="ic" style={{ background: s.bg, color: s.col }}>
                    {s.ic}
                  </div>
                  <div>{a.mensaje}</div>
                </div>
              );
            })
          ) : (
            <EmptyState msg="Sin alertas activas" ic="✓" />
          )}
          {d.cotizaciones.aprobadasSinVenta > 0 && (
            <div className="alert-li">
              <div className="ic" style={{ background: '#efeaff', color: '#503fa0' }}>
                ▥
              </div>
              <div>
                <b>{d.cotizaciones.aprobadasSinVenta}</b> cotización(es) aprobada(s) esperando convertirse en venta
              </div>
            </div>
          )}
        </div>
      </div>

      {sec.ventas && (
        <div className={`grid ${sec.inventario ? 'cols-2' : ''}`} style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Últimas ventas</h3>
            {d.ventasRecientes.length ? (
              <div className="tablewrap" style={{ border: 'none' }}>
                <table>
                  <tbody>
                    {d.ventasRecientes.slice(0, 5).map((v) => (
                      <tr key={v.id}>
                        <td className="mono">{v.factura}</td>
                        <td>{v.cliente}</td>
                        <td className="num">{money(v.total)}</td>
                        <td>
                          <EstadoTag estado={v.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState msg="Sin ventas" />
            )}
          </div>
          {sec.inventario && <StockCritico d={d} />}
        </div>
      )}
    </>
  );
}

function StockCritico({ d }: { d: DashboardResumen }) {
  return (
    <div className="card">
      <h3>Stock crítico — reabastecer</h3>
      {d.inventario.reponer.length ? (
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
                  <td className="num" style={{ color: 'var(--muted)', fontSize: 12 }}>
                    faltan {p.faltan}
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
  );
}
