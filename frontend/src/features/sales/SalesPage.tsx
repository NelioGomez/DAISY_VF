/* MÓDULO: VENTAS Y FACTURACIÓN (RF-12/13/14) — IVA, descuenta stock.
   Filtros por estado, forma de pago, vendedor y fechas con chips, y paginación (n.° 18-20). */
import { Link } from 'react-router-dom';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Venta } from '../../types';
import { fmtDate, money } from '../../utils/format';
import { InvoiceModal } from './InvoiceModal';
import { useExportVentas } from './useExportVentas';

export function SalesPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canSell = can('sales:write') && can('customers:read') && can('products:read');
  const modal = useModal();
  const exportVentas = useExportVentas();
  const vendedores = [...new Set(db.ventas.map((v) => v.vendedor).filter(Boolean))].sort();
  const selects: SelectFilter<Venta>[] = [
    {
      key: 'estado',
      label: 'Estado',
      options: ['Pagada', 'Parcial', 'Pendiente', 'Vencida', 'Anulada'].map((x) => ({ value: x, label: x === 'Vencida' ? 'Vencidas (con saldo)' : x })),
      test: (v, x) => (x === 'Vencida' ? v.vencida && v.estado !== 'Anulada' && v.saldo > 0 : v.estado === x),
    },
    { key: 'metodo', label: 'Forma de pago', options: ['Contado', 'Transferencia', 'Crédito'].map((x) => ({ value: x, label: x })), test: (v, x) => v.metodo === x },
    ...(vendedores.length > 1 ? [{ key: 'vendedor', label: 'Vendedor', options: vendedores.map((x) => ({ value: x, label: x })), test: (v: Venta, x: string) => v.vendedor === x }] : []),
  ];
  const f = useListFilters(db.ventas, { search: (v) => [v.factura, v.cliN, v.ruc, v.cotizacion], selects, date: (v) => v.fecha });
  const pg = usePaged(f.filtered, f.key, 'ventas');
  const totalFiltrado = f.filtered.filter((v) => v.estado !== 'Anulada').reduce((t, v) => t + v.total, 0);

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
      <FilterBar f={f} placeholder="Buscar por factura, cliente, RUC o cotización…" />
      {f.active.length > 0 && (
        <p className="doc-meta" style={{ margin: '-6px 0 10px' }}>
          Total facturado en la selección (sin anuladas): <b>{money(totalFiltrado)}</b>
        </p>
      )}
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
            {!!db.ventas.length && !f.filtered.length && <EmptyRow cols={8} msg="Ninguna venta coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((v) => (
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
      <Pagination p={pg} label="ventas" />
    </>
  );
}
