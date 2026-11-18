/* MÓDULO: VENTAS Y FACTURACIÓN (RF-12/13/14) — IVA, descuenta stock.
   Filtros por estado, forma de pago, vendedor y fechas con chips, y paginación (n.° 18-20). */
import { Link } from 'react-router-dom';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { EstadoTag, Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Venta } from '../../types';
import { fmtDate, money } from '../../utils/format';
import { CustomerRef } from '../customers/CustomerRef';
import { useRecords } from '../records/records';
import { useExportVentas } from './useExportVentas';

export function SalesPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canSell = can('sales:write') && can('customers:read') && can('products:read');
  const { openRecord } = useRecords();
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
  const columns: Column<Venta>[] = [
    {
      id: 'factura',
      label: 'Factura',
      required: true,
      cellClass: 'mono',
      cell: (v) => (
        <button type="button" className="link-btn mono" onClick={(e) => {
          e.stopPropagation();
          openRecord('venta', v.id);
        }}>
          {v.factura}
        </button>
      ),
    },
    { id: 'fecha', label: 'Fecha', cellClass: 'mono', cell: (v) => fmtDate(v.fecha) },
    { id: 'cliente', label: 'Cliente', cell: (v) => <CustomerRef id={v.cli}>{v.cliN}</CustomerRef> },
    { id: 'ruc', label: 'RUC', cellClass: 'mono', cell: (v) => v.ruc || '—', hidden: true },
    { id: 'metodo', label: 'Método', cell: (v) => <Tag>{v.metodo}</Tag> },
    { id: 'vendedor', label: 'Vendedor', cell: (v) => v.vendedor || '—', hidden: true },
    { id: 'cotizacion', label: 'Cotización', cellClass: 'mono', cell: (v) => v.cotizacion ?? '—', hidden: true },
    { id: 'vence', label: 'Vence', cellClass: 'mono', cell: (v) => (v.vence ? fmtDate(v.vence) : '—'), hidden: true },
    { id: 'total', label: 'Total', className: 'num', cell: (v) => money(v.total) },
    {
      id: 'saldo',
      label: 'Saldo',
      className: 'num',
      cell: (v) => (
        <>
          {v.estado === 'Anulada' ? '—' : money(v.saldo)}
          {v.vencida && v.estado !== 'Anulada' && ' ⚠'}
        </>
      ),
      tdProps: (v) => (v.saldo > 0 && v.estado !== 'Anulada' ? { style: { color: 'var(--red)', fontWeight: 700 } } : {}),
    },
    { id: 'estado', label: 'Estado', cell: (v) => <EstadoTag estado={v.estado} /> },
  ];
  const cols = useColumns('ventas', columns);
  const ncols = cols.visible.length;

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
      <FilterBar f={f} placeholder="Buscar por factura, cliente, RUC o cotización…">
        <ColumnsButton cols={cols} />
      </FilterBar>
      {f.active.length > 0 && (
        <p className="doc-meta" style={{ margin: '-6px 0 10px' }}>
          Total facturado en la selección (sin anuladas): <b>{money(totalFiltrado)}</b>
        </p>
      )}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <ColumnHeads cols={cols} />
            </tr>
          </thead>
          <tbody>
            {!db.ventas.length && <EmptyRow cols={ncols} msg="Sin ventas registradas" />}
            {!!db.ventas.length && !f.filtered.length && <EmptyRow cols={ncols} msg="Ninguna venta coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((v) => (
              <tr key={v.id} className="row-link" onClick={() => openRecord('venta', v.id)}>
                <ColumnCells cols={cols} row={v} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="ventas" />
    </>
  );
}
