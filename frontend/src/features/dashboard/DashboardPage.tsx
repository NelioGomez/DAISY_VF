/* MÓDULO: DASHBOARD (RF-20 / KPIs) — datos de GET /dashboard/summary.
   Centro de trabajo del día (n.° 40), acciones rápidas (n.° 8), KPIs con tendencia (n.° 9),
   más vendidos (n.° 10), antigüedad de cuentas por cobrar (n.° 24) y KPI de manufactura
   (rendimiento, no conformidad y tiempo de ciclo). */
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KpiCard } from '../../components/cards/KpiCard';
import { BarChart } from '../../components/charts/BarChart';
import { EmptyState } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import type { DashboardResumen, ResumenProduccion } from '../../types';
import { money } from '../../utils/format';
import { MovementFormModal } from '../inventory/MovementFormModal';
import { OrderFormModal } from '../production/OrderFormModal';
import { fmtHoras, pct } from '../production/productionFormat';
import { PurchaseFormModal } from '../purchases/PurchaseFormModal';
import { QuotationFormModal } from '../quotations/QuotationFormModal';
import { agenda, variacion } from './agenda';

/** "▲ 12 % vs. 30 días anteriores" (o el texto alterno si no hay base para comparar). */
function Trend({ actual, previo, sinBase }: { actual: number; previo: number; sinBase: string }) {
  const v = variacion(actual, previo);
  if (v === null) return <>{sinBase}</>;
  return (
    <>
      <span className={`trend ${v > 0 ? 'up' : v < 0 ? 'down' : ''}`}>
        <span aria-hidden="true">{v > 0 ? '▲' : v < 0 ? '▼' : '='}</span> {Math.abs(v)} %
      </span>{' '}
      vs. 30 días anteriores
    </>
  );
}

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
  const ticket = d.ventas30.facturas ? d.ventas30.total / d.ventas30.facturas : 0;
  const ticketPrevio = d.ventasPrevias.facturas ? d.ventasPrevias.total / d.ventasPrevias.facturas : 0;
  const conv = d.cotizaciones.conversion;
  const tasa = (x: { emitidas: number; convertidas: number }) => (x.emitidas ? Math.round((x.convertidas / x.emitidas) * 100) : 0);
  const kpis = [
    sec.ventas && (
      <KpiCard
        key="v"
        lbl="Ventas (30 días)"
        val={money(d.ventas30.total)}
        sub={<Trend actual={d.ventas30.total} previo={d.ventasPrevias.total} sinBase={`${d.ventas30.facturas} facturas`} />}
        ic="⛽"
      />
    ),
    sec.ventas && (
      <KpiCard
        key="t"
        lbl="Ticket promedio"
        val={money(ticket)}
        sub={<Trend actual={ticket} previo={ticketPrevio} sinBase={`${d.ventas30.facturas} facturas en 30 días`} />}
        ic="◈"
      />
    ),
    sec.cotizaciones && (
      <KpiCard
        key="cv"
        lbl="Conversión de cotizaciones"
        val={`${tasa(conv.actual)} %`}
        sub={`${conv.actual.convertidas} de ${conv.actual.emitidas} emitidas${conv.previa.emitidas ? `; antes ${tasa(conv.previa)} %` : ''}`}
        ic="▥"
      />
    ),
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
      <QuickActions />
      <div className={`grid cols-${Math.min(3, Math.max(2, kpis.length))}`} style={{ marginBottom: 16 }}>
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
        <Agenda d={d} />
      </div>

      {d.produccion && <Manufactura p={d.produccion} />}

      {(sec.ventas || sec.cxc) && (
        <div className={`grid ${sec.ventas && sec.cxc ? 'cols-2' : ''}`} style={{ marginTop: 16 }}>
          {sec.ventas && <TopProductos d={d} />}
          {sec.cxc && <Antiguedad d={d} />}
        </div>
      )}

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
  const { can } = useAuth();
  return (
    <div className="card">
      <div className="card-h">
        <h3>Stock crítico — reabastecer</h3>
        {can('purchases:read') && d.inventario.reponer.length > 0 && (
          <Link to="/app/compras?tab=reabastecimiento" className="b b-out b-sm">
            Ver sugerencias de compra →
          </Link>
        )}
      </div>
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

/** Centro de trabajo del día (n.° 40): cada pendiente lleva a donde se resuelve. */
function Agenda({ d }: { d: DashboardResumen }) {
  const { can } = useAuth();
  const items = agenda(d, can);
  return (
    <div className="card">
      <h3>Pendientes para hoy</h3>
      {items.length ? (
        <div className="agenda">
          {items.map((i) => (
            <Link key={i.tipo} to={i.link} className="agenda-li">
              <span className={`ic sev-${i.severidad}`} aria-hidden="true">
                {i.ic}
              </span>
              <span className="txt">{i.mensaje}</span>
              <span className="cta">{i.accion}</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState msg="Todo al día: no hay pendientes" ic="✓" />
      )}
    </div>
  );
}

/** Acciones rápidas (n.° 8), según los permisos del rol. */
function QuickActions() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const modal = useModal();
  const actions: Array<{ key: string; show: boolean; label: string; kbd?: string; primary?: boolean; run(): void }> = [
    { key: 'venta', show: can('sales:write') && can('customers:read'), label: 'Nueva venta', kbd: 'Alt+V', primary: true, run: () => navigate('/app/ventas/nueva') },
    {
      key: 'cot',
      show: can('quotations:write') && can('customers:read'),
      label: 'Nueva cotización',
      kbd: 'Alt+C',
      run: () => {
        navigate('/app/cotizaciones');
        modal.open(<QuotationFormModal />);
      },
    },
    { key: 'entrada', show: can('inventory:write'), label: 'Registrar entrada', run: () => modal.open(<MovementFormModal tipo="Entrada" />) },
    {
      key: 'compra',
      show: can('purchases:write'),
      label: 'Nueva compra',
      run: () => {
        navigate('/app/compras');
        modal.open(<PurchaseFormModal />);
      },
    },
    {
      key: 'op',
      show: can('production:write'),
      label: 'Orden de producción',
      run: () => {
        navigate('/app/produccion');
        modal.open(<OrderFormModal />);
      },
    },
    { key: 'pago', show: can('payments:write'), label: 'Registrar pago', run: () => navigate('/app/pagos') },
  ];
  const visible = actions.filter((a) => a.show);
  if (!visible.length) return null;
  return (
    <div className="quick" role="toolbar" aria-label="Acciones rápidas">
      {visible.map((a) => (
        <button key={a.key} className={`b ${a.primary ? 'b-amber' : 'b-out'}`} onClick={a.run} title={a.kbd ? `Atajo: ${a.kbd}` : undefined}>
          <span aria-hidden="true">＋</span> {a.label}
          {a.kbd && <kbd>{a.kbd}</kbd>}
        </button>
      ))}
    </div>
  );
}

/** Ranking de productos más vendidos en 30 días (n.° 10). */
function TopProductos({ d }: { d: DashboardResumen }) {
  const max = Math.max(1, ...d.topProductos.map((p) => p.unidades));
  return (
    <div className="card">
      <div className="card-h">
        <h3>Más vendidos (30 días)</h3>
        <Link to="/app/reportes" className="b b-out b-sm">
          Ver reportes
        </Link>
      </div>
      {d.topProductos.length ? (
        <ol className="rank">
          {d.topProductos.map((p, i) => (
            <li key={p.sku}>
              <span className="pos">{i + 1}</span>
              <span className="name">
                {p.nombre}
                <small className="mono">{p.sku}</small>
              </span>
              <span className="units">{p.unidades} u.</span>
              <Bar value={p.unidades} max={max} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState msg="Sin ventas en los últimos 30 días" />
      )}
    </div>
  );
}

/** Antigüedad de las cuentas por cobrar (n.° 24): mismos tramos que el reporte. */
function Antiguedad({ d }: { d: DashboardResumen }) {
  const total = d.cxc.antiguedad.reduce((t, a) => t + a.monto, 0);
  return (
    <div className="card">
      <div className="card-h">
        <h3>Antigüedad de cuentas por cobrar</h3>
        <Link to="/app/pagos" className="b b-out b-sm">
          Ir a Pagos
        </Link>
      </div>
      {total > 0 ? (
        <ul className="aging">
          {d.cxc.antiguedad.map((a) => (
            <li key={a.clave} className={`ag-${a.clave}`}>
              <span className="name">{a.etiqueta}</span>
              <span className="units">
                {a.facturas} {a.facturas === 1 ? 'factura' : 'facturas'}
              </span>
              <span className="amt">{money(a.monto)}</span>
              <Bar value={a.monto} max={total} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState msg="No hay saldos pendientes" ic="✓" />
      )}
    </div>
  );
}

/** KPI de manufactura (entrega 2), calculados por el servidor con los datos de producción y calidad. */
function Manufactura({ p }: { p: ResumenProduccion }) {
  const total = p.liberadasCalidad30 + p.desechadas30 + p.porInspeccionar30;
  const w = (v: number) => `${total ? (v / total) * 100 : 0}%`;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <h3>Manufactura — últimos 30 días</h3>
        <Link to="/app/produccion" className="b b-out b-sm">
          Ir a Producción
        </Link>
      </div>
      <div className="mini-kpis mfg-kpis">
        <div>
          <span>Rendimiento (yield)</span>
          <b>{pct(p.rendimiento)}</b>
          <small>{p.planificadas30 ? `${p.liberadasCalidad30} liberadas de ${p.planificadas30} planificadas` : 'sin órdenes terminadas'}</small>
        </div>
        <div>
          <span>Tasa de no conformidad</span>
          <b>{pct(p.noConformidad)}</b>
          <small>{p.inspeccionadas30 ? `${p.noConformes30} de ${p.inspeccionadas30} inspeccionadas` : 'sin inspecciones'}</small>
        </div>
        <div>
          <span>Tiempo de ciclo promedio</span>
          <b>{p.terminadas30 ? fmtHoras(p.cicloHoras) : '—'}</b>
          <small>{p.terminadas30} orden(es) terminada(s)</small>
        </div>
        <div>
          <span>Lotes por inspeccionar</span>
          <b>{p.lotesPorInspeccionar}</b>
          <small>
            {p.enProceso} OP en proceso · {p.liberadas} por iniciar
          </small>
        </div>
      </div>
      {total > 0 ? (
        <>
          <div className="mfg-bar" role="img" aria-label={`${p.liberadasCalidad30} unidades liberadas, ${p.desechadas30} desechadas y ${p.porInspeccionar30} por inspeccionar`}>
            <i className="ok" style={{ width: w(p.liberadasCalidad30) }} />
            <i className="bad" style={{ width: w(p.desechadas30) }} />
            <i className="wait" style={{ width: w(p.porInspeccionar30) }} />
          </div>
          <ul className="mfg-legend">
            <li className="ok">{p.liberadasCalidad30} liberadas al inventario</li>
            <li className="bad">{p.desechadas30} scrap</li>
            <li className="wait">{p.porInspeccionar30} por inspeccionar o en retrabajo</li>
          </ul>
        </>
      ) : (
        <EmptyState msg="Sin órdenes terminadas en los últimos 30 días" ic="⚙" />
      )}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }): ReactNode {
  return (
    <span className="meter" aria-hidden="true">
      <i style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </span>
  );
}

