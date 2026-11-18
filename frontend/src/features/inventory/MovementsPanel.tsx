/* Bitácora de movimientos (kardex) paginada y filtrada en el servidor (mejoras n.° 18-20):
   tipo, ubicación, fechas y búsqueda; cada fila muestra dónde ocurrió y su documento de origen. */
import { DocChip } from '../../components/common/DocChain';
import { EmptyRow } from '../../components/feedback/Empty';
import { ErrorRow } from '../../components/feedback/ErrorState';
import { SkeletonRows } from '../../components/feedback/Skeleton';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { TipoMovTag } from '../../components/tables/Tag';
import { useDebounced } from '../../hooks/useDebounced';
import { useFilterState, type SelectDef } from '../../hooks/useListFilters';
import { useServerPage } from '../../hooks/useServerPage';
import { mapMovimiento } from '../../services/api/mappers';
import { fmtDateTime, money } from '../../utils/format';
import { UBICACIONES } from '../../utils/locations';
import { useOpenDocument } from '../documents/useOpenDocument';
import { ProductDrawer } from '../products/ProductDrawer';

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
  const modal = useModal();
  const doc = useOpenDocument();
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

  return (
    <>
      <FilterBar f={f} placeholder="Buscar por SKU, producto, documento (FAC, OP, LOT, TR…) o nota…" dateLabel="Fecha" />
      <div className={`tablewrap ${loading && rows ? 'is-loading' : ''}`}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Ubicación</th>
              <th className="num">Cant.</th>
              <th className="num">Costo unit.</th>
              <th className="num" title="Stock total después del movimiento">
                Stock final
              </th>
              <th>Documento / referencia</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            {error && <ErrorRow cols={9} msg={error} onRetry={reload} />}
            {!rows && !error && <SkeletonRows cols={9} />}
            {rows && !rows.length && !error && <EmptyRow cols={9} msg={f.active.length ? 'Ningún movimiento coincide con los filtros' : 'Sin movimientos'} ic={f.active.length ? '🔍' : '📭'} />}
            {rows?.map((m) => (
              <tr key={m.id}>
                <td className="mono" style={{ fontSize: 12 }}>
                  {fmtDateTime(m.fecha)}
                </td>
                <td>
                  <TipoMovTag tipo={m.tipo} />
                </td>
                <td>
                  <button className="link-btn" onClick={() => modal.open(<ProductDrawer productoId={m.prod} />)}>
                    {m.prodN}
                  </button>
                  <div className="sub-num mono">{m.sku}</div>
                </td>
                <td>
                  <span className={`loc-chip loc-${m.ubicacionId}`}>{m.ubicacion}</span>
                </td>
                <td className="num">
                  {m.tipo === 'Ajuste' ? (m.stockDespues >= m.stockAntes ? '+' : '−') : m.tipo === 'Salida' ? '−' : '+'}
                  {m.cant}
                </td>
                <td className="num">{m.costo ? money(m.costo) : '—'}</td>
                <td className="num">{m.stockDespues}</td>
                <td title={m.nota}>
                  {m.origen ? (
                    <DocChip tipo={m.origen.tipo} codigo={m.origen.codigo} detalle={m.origen.lote} onOpen={doc.canOpen(m.origen) ? () => doc.open(m.origen!) : undefined} />
                  ) : (
                    m.ref || m.nota || '—'
                  )}
                </td>
                <td className="mono">@{m.resp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pager} label="movimientos" />
    </>
  );
}
