/* MÓDULO: PAGOS Y CUENTAS POR COBRAR (RF-14/15) */
import { KpiCard } from '../../components/cards/KpiCard';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import { fmtDate, money } from '../../utils/format';
import { PaymentFormModal } from './PaymentFormModal';

export function PaymentsPage() {
  const { db } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const cxc = db.cxc;
  const total = cxc.reduce((a, x) => a + x.saldo, 0);
  const vencidas = cxc.filter((x) => x.vencida);
  const cobrado = db.pagos.reduce((a, p) => a + p.monto, 0);

  return (
    <>
      <ViewHead title="Pagos y Cuentas por Cobrar" desc="Abonos parciales o completos y control de saldos por factura." />
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Total por cobrar" val={money(total)} sub={cxc.length + ' facturas'} ic="◷" tone={total > 0 ? 'warn' : 'good'} />
        <KpiCard lbl="Facturas vencidas" val={vencidas.length} sub={money(vencidas.reduce((a, x) => a + x.saldo, 0))} ic="◴" tone={vencidas.length ? 'warn' : 'good'} />
        <KpiCard lbl="Pagos registrados" val={db.pagos.length} sub={money(cobrado)} ic="◵" tone="good" />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cuentas por cobrar</h3>
        <div className="tablewrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th className="num">Total</th>
                <th className="num">Saldo</th>
                <th>Vence</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!cxc.length && <EmptyRow cols={7} msg="Sin saldos pendientes — todo cobrado" ic="✓" />}
              {cxc.map((x) => (
                <tr key={x.venta}>
                  <td className="mono">{x.factura}</td>
                  <td>{x.cliN}</td>
                  <td className="num">{money(x.total)}</td>
                  <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                    {money(x.saldo)}
                  </td>
                  <td className="mono" style={x.vencida ? { color: 'var(--red)' } : undefined}>
                    {x.vence ? fmtDate(x.vence) : '—'}
                    {x.vencida && ` ⚠ ${x.diasVencida} d`}
                  </td>
                  <td>
                    <EstadoTag estado={x.estado} />
                  </td>
                  <td>
                    {can('payments:write') && (
                      <button className="b b-amber b-sm" onClick={() => modal.open(<PaymentFormModal cuenta={x} />)}>
                        Registrar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Historial de pagos</h3>
        <div className="tablewrap" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Factura</th>
                <th>Cliente</th>
                <th className="num">Monto</th>
                <th>Medio</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {!db.pagos.length && <EmptyRow cols={6} msg="Sin pagos" />}
              {db.pagos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{fmtDate(p.fecha)}</td>
                  <td className="mono">{p.factura}</td>
                  <td>{p.cliN}</td>
                  <td className="num">{money(p.monto)}</td>
                  <td>
                    <Tag>{p.metodo}</Tag>
                  </td>
                  <td className="mono">{p.ref || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
