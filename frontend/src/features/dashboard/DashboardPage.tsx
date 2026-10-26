/* MÓDULO: DASHBOARD (RF-20 / KPIs) */
import type { ReactNode } from 'react';
import { KpiCard } from '../../components/cards/KpiCard';
import { BarChart } from '../../components/charts/BarChart';
import { EmptyState } from '../../components/feedback/Empty';
import { useData } from '../../store/hooks';
import { isOverdue, money } from '../../utils/format';
import { MiniCritico, MiniVentas } from './MiniTables';
import { ordenesAbiertas, stockCritico, totalCxC, ventas30Dias, ventasMesActual, ventasPorDia } from './kpis';

interface Alerta {
  key: string;
  ic: string;
  bg: string;
  col: string;
  txt: ReactNode;
}

export function DashboardPage() {
  const { db } = useData();
  const critico = stockCritico(db);
  const opi = ordenesAbiertas(db);
  const cxc = totalCxC(db);
  const cotPend = db.cotizaciones.filter((c) => c.estado === 'Pendiente').length;

  const alertas: Alerta[] = [
    ...critico.map((p) => ({
      key: 'st-' + p.id, ic: '▼', bg: 'var(--red-soft)', col: '#b32a20',
      txt: (<><b>{p.nombre}</b> en stock crítico ({p.stock}/{p.stockMin})</>),
    })),
    ...db.ventas.filter((v) => v.saldo > 0 && isOverdue(v.vence)).map((v) => ({
      key: 'vt-' + v.id, ic: '◷', bg: '#fff2d6', col: '#9a6500',
      txt: (<>Factura <b>{v.factura}</b> vencida — saldo {money(v.saldo)}</>),
    })),
    ...db.consultas.filter((c) => c.estado === 'Nueva').map((c) => ({
      key: 'cn-' + c.id, ic: '◫', bg: 'var(--blue-soft)', col: '#205283',
      txt: (<>Nueva consulta web de <b>{c.nombre}</b></>),
    })),
  ];

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Ventas (30 días)" val={money(ventas30Dias(db))} sub={ventasMesActual(db).length + ' facturas'} ic="⛽" />
        <KpiCard lbl="Stock crítico" val={critico.length} sub="productos ≤ mínimo" ic="▼" tone={critico.length ? 'warn' : 'good'} />
        <KpiCard lbl="Cuentas por cobrar" val={money(cxc)} sub={db.ventas.filter((x) => x.saldo > 0).length + ' facturas'} ic="◷" tone={cxc > 0 ? 'warn' : 'good'} />
        <KpiCard lbl="Órdenes OPI abiertas" val={opi.length} sub={cotPend + ' cotizaciones pend.'} ic="▩" />
      </div>

      <div className="split">
        <div className="card">
          <h3>Ventas diarias — últimos 14 días</h3>
          <BarChart data={ventasPorDia(db, 14)} />
        </div>
        <div className="card">
          <h3>Alertas recientes</h3>
          {alertas.length ? (
            alertas.slice(0, 8).map((a) => (
              <div className="alert-li" key={a.key}>
                <div className="ic" style={{ background: a.bg, color: a.col }}>
                  {a.ic}
                </div>
                <div>{a.txt}</div>
              </div>
            ))
          ) : (
            <EmptyState msg="Sin alertas activas" ic="✓" />
          )}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Últimas ventas</h3>
          <MiniVentas ventas={db.ventas} />
        </div>
        <div className="card">
          <h3>Stock crítico — reabastecer</h3>
          <MiniCritico productos={critico} />
        </div>
      </div>
    </>
  );
}
