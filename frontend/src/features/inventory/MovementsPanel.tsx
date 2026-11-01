/* Bitácora de movimientos (kardex) paginada y filtrada en el servidor (mejoras n.° 18-20):
   tipo, ubicación, fechas y búsqueda; cada fila muestra dónde ocurrió y su documento de origen.
   Columnas configurables (n.° 21) y vista previa del producto al pasar el cursor (n.° 34). */
import { DocChip } from '../../components/common/DocChain';
import { EmptyRow } from '../../components/feedback/Empty';
import { ErrorRow } from '../../components/feedback/ErrorState';
import { SkeletonRows } from '../../components/feedback/Skeleton';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { TipoMovTag } from '../../components/tables/Tag';
import { useDebounced } from '../../hooks/useDebounced';
import { useFilterState, type SelectDef } from '../../hooks/useListFilters';
import { useServerPage } from '../../hooks/useServerPage';
import { mapMovimiento } from '../../services/api/mappers';
import type { Movimiento } from '../../types';
import { fmtDateTime, money } from '../../utils/format';
import { UBICACIONES } from '../../utils/locations';
import { useOpenDocument } from '../documents/useOpenDocument';
import { ProductRef } from '../products/ProductRef';
import { useRecords } from '../records/records';

const MODULES = ['inventory', 'purchases', 'sales', 'production'] as const;
const SELECTS: SelectDef[] = [
  {
    key: 'type',
    label: 'Tipo',
    options: [
      { value: 'ENTRY', label: 'Entradas' },
      { value: 'EXIT', label: 'Salidas' },
      { value: 'ADJUSTMENT', label: 'Ajustes' },
    ],
  },
  { key: 'locationId', label: 'Ubicación', options: UBICACIONES.map((u) => ({ value: String(u.id), label: u.nombre })) },
];

export function MovementsPanel() {
  const doc = useOpenDocument();
  const { openRecord } = useRecords();
  const f = useFilterState(SELECTS, true);
  const search = useDebounced(f.q.trim(), 350);
  const query = {
    search: search || undefined,
    type: f.values.type || undefined,
    locationId: f.values.locationId || undefined,
    from: f.desde || undefined,
    to: f.hasta || undefined,
  };
  const { rows, loading, error, reload, pager } = useServerPage('/inventory/movements', query, mapMovimiento, MODULES, 'inventario-movimientos');
  const columns: Column<Movimiento>[] = [
    { id: 'fecha', label: 'Fecha', required: true, cellClass: 'mono', cell: (m) => fmtDateTime(m.fecha), tdProps: () => ({ style: { fontSize: 12 } }) },
    { id: 'tipo', label: 'Tipo', cell: (m) => <TipoMovTag tipo={m.tipo} /> },
    {
      id: 'producto',
      label: 'Producto',
      required: true,
      cell: (m) => (
        <>
          <ProductRef id={m.prod}>
            <button className="link-btn" onClick={() => openRecord('producto', m.prod)}>
              {m.prodN}
            </button>
          </ProductRef>
          <div className="sub-num mono">{m.sku}</div>
        </>
      ),
    },
    { id: 'ubicacion', label: 'Ubicación', cell: (m) => <span className={`loc-chip loc-${m.ubicacionId}`}>{m.ubicacion}</span> },
    {
      id: 'cantidad',
      label: 'Cant.',
      className: 'num',
      cell: (m) => (
        <>
          {m.tipo === 'Ajuste' ? (m.stockDespues >= m.stockAntes ? '+' : '−') : m.tipo === 'Salida' ? '−' : '+'}
          {m.cant}
        </>
      ),
    },
    { id: 'costo', label: 'Costo unit.', className: 'num', cell: (m) => (m.costo ? money(m.costo) : '—') },
    { id: 'antes', label: 'Stock antes', className: 'num', cell: (m) => m.stockAntes, hidden: true },
    { id: 'final', label: 'Stock final', header: <span title="Stock total después del movimiento">Stock final</span>, className: 'num', cell: (m) => m.stockDespues },
    {
      id: 'documento',
      label: 'Documento / referencia',
      cell: (m) =>
        m.origen ? (
          <DocChip tipo={m.origen.tipo} codigo={m.origen.codigo} detalle={m.origen.lote} onOpen={doc.canOpen(m.origen) ? () => doc.open(m.origen!) : undefined} />
        ) : (
          m.ref || m.nota || '—'
        ),
      tdProps: (m) => ({ title: m.nota }),
    },
    { id: 'nota', label: 'Nota', cell: (m) => m.nota || '—', hidden: true },
    { id: 'responsable', label: 'Responsable', cellClass: 'mono', cell: (m) => `@${m.resp}` },
  ];
  const cols = useColumns('inventario-movimientos', columns);
  const ncols = cols.visible.length;

  return (
    <>
      <FilterBar f={f} placeholder="Buscar por SKU, producto, documento (FAC, OP, LOT, TR…) o nota…" dateLabel="Fecha">
        <ColumnsButton cols={cols} />
      </FilterBar>
      <div className={`tablewrap ${loading && rows ? 'is-loading' : ''}`}>
        <table>
          <thead>
            <tr>
              <ColumnHeads cols={cols} />
            </tr>
          </thead>
          <tbody>
            {error && <ErrorRow cols={ncols} msg={error} onRetry={reload} />}
            {!rows && !error && <SkeletonRows cols={ncols} />}
            {rows && !rows.length && !error && <EmptyRow cols={ncols} msg={f.active.length ? 'Ningún movimiento coincide con los filtros' : 'Sin movimientos'} ic={f.active.length ? '🔍' : '📭'} />}
            {rows?.map((m) => (
              <tr key={m.id}>
                <ColumnCells cols={cols} row={m} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pager} label="movimientos" />
    </>
  );
}
