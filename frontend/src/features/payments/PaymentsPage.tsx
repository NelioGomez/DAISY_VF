/* MÓDULO: PAGOS Y CUENTAS POR COBRAR (RF-14/15) */
import { KpiCard } from '../../components/cards/KpiCard';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useData } from '../../store/hooks';
import { fmtDate, isOverdue, money } from '../../utils/format';
import { PaymentFormModal } from './PaymentFormModal';

export function PaymentsPage() {
  const { db } = useData();
  const modal = useModal();
  const cxc = db.ventas.filter((x) => x.saldo > 0);
  const total = cxc.reduce((a, x) => a + x.saldo, 0);
  const vencidas = cxc.filter((x) => isOverdue(x.vence));
  const cobrado = db.pagos.reduce((a, p) => a + p.monto, 0);

  return (
    <>
      <ViewHead title="Pagos y Cuentas por Cobrar" desc="Registro de abonos parciales/completos y control de saldos por cliente." />
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Total por cobrar" val={money(total)} sub={cxc.length + ' facturas'} ic="◷" tone={total > 0 ? 'warn' : 'good'} />
        <KpiCard lbl="Facturas vencidas" val={vencidas.length} sub="requieren gestión" ic="◴" tone={vencidas.length ? 'warn' : 'good'} />
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
              {!cxc.length && <EmptyRow cols={7} msg="Sin saldos pendientes — todo cobrado ✓" ic="✓" />}
              {cxc.map((x) => {
                const venc = isOverdue(x.vence);
                return (
                  <tr key={x.id}>
                    <td className="mono">{x.factura}</td>
                    <td>{x.cliN}</td>
                    <td className="num">{money(x.total)}</td>
                    <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                      {money(x.saldo)}
                    </td>
                    <td className="mono" style={venc ? { color: 'var(--red)' } : undefined}>
                      {x.vence ? fmtDate(x.vence) : '—'}
                      {venc && ' ⚠'}
                    </td>
                    <td>
                      <EstadoTag estado={x.estado} />
                    </td>
                    <td>
                      <button className="b b-amber b-sm" onClick={() => modal.open(<PaymentFormModal ventaId={x.id} />)}>
                        Registrar pago
                      </button>
                    </td>
                  </tr>
                );
              })}
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
                <th className="num">Monto</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {!db.pagos.length && <EmptyRow cols={4} msg="Sin pagos" />}
              {[...db.pagos].reverse().map((p) => (
                <tr key={p.id}>
                  <td className="mono">{fmtDate(p.fecha)}</td>
                  <td className="mono">{p.factura}</td>
                  <td className="num">{money(p.monto)}</td>
                  <td>
                    <Tag>{p.metodo}</Tag>
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
