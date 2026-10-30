/* MÓDULO: VENTAS Y FACTURACIÓN (RF-12/13/14) — IVA, descuenta stock */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import { fmtDate, matches, money } from '../../utils/format';
import { InvoiceModal } from './InvoiceModal';
import { useExportVentas } from './useExportVentas';

export function SalesPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canSell = can('sales:write') && can('customers:read') && can('products:read');
  const modal = useModal();
  const exportVentas = useExportVentas();
  const [q, setQ] = useState('');
  const rows = db.ventas.filter((v) => matches(q, v.factura, fmtDate(v.fecha), v.cliN, v.metodo, v.estado));

  return (
    <>
      <ViewHead
        title="Ventas y Facturación"
        desc="Registra ventas: el servidor aplica el impuesto configurado, genera la factura, descuenta el inventario y crea la cuenta por cobrar."
        actions={
          <>
            <button className="b b-out" onClick={exportVentas}>
              ⬇ Exportar CSV
            </button>
            {canSell && (
              <Link className="b b-amber" to="/app/ventas/nueva" title="Atajo: Alt + V">
                + Nueva venta
              </Link>
            )}
          </>
        }
      />
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por factura o cliente…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Método</th>
              <th className="num">Total</th>
              <th className="num">Saldo</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.ventas.length && <EmptyRow cols={8} msg="Sin ventas registradas" />}
            {rows.map((v) => (
              <tr key={v.id}>
                <td className="mono">{v.factura}</td>
                <td className="mono">{fmtDate(v.fecha)}</td>
                <td>{v.cliN}</td>
                <td>
                  <Tag>{v.metodo}</Tag>
                </td>
                <td className="num">{money(v.total)}</td>
                <td className="num" style={v.saldo > 0 && v.estado !== 'Anulada' ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                  {v.estado === 'Anulada' ? '—' : money(v.saldo)}
                  {v.vencida && v.estado !== 'Anulada' && ' ⚠'}
                </td>
                <td>
                  <EstadoTag estado={v.estado} />
                </td>
                <td>
                  <button className="b b-out b-sm" onClick={() => modal.open(<InvoiceModal ventaId={v.id} />)}>
                    Factura
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
