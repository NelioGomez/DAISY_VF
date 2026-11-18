/* Existencias por producto con su reparto entre bodega y sucursal (mejora n.° 23), filtros con
   chips (n.° 18 y 19), paginación (n.° 20), encabezado fijo (n.° 22), columnas configurables
   (n.° 21) y vista previa del producto al pasar el cursor (n.° 34). */
import { ProductImage } from '../../components/common/ProductImage';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { StockTag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { exportCSV } from '../../utils/csv';
import { money } from '../../utils/format';
import { BODEGA, SUCURSAL } from '../../utils/locations';
import { PriceModal } from '../products/PriceModal';
import { ProductRef } from '../products/ProductRef';
import { useRecords } from '../records/records';
import { TransferFormModal } from './TransferFormModal';

const estadoDe = (p: Producto) => (p.stock <= 0 ? 'agotado' : p.stock <= p.stockMin ? 'critico' : 'ok');

export function StockPanel() {
  const { db } = useData();
  const { can } = useAuth();
  const modal = useModal();
  const selects: SelectFilter<Producto>[] = [
    {
      key: 'categoria',
      label: 'Categoría',
      options: db.categorias.map((c) => ({ value: c.id, label: c.nombre })),
      test: (p, v) => p.categoriaId === v,
    },
    { key: 'marca', label: 'Marca', options: db.marcas.map((m) => ({ value: m.id, label: m.nombre })), test: (p, v) => p.marcaId === v },
    {
      key: 'estado',
      label: 'Existencia',
      options: [
        { value: 'ok', label: 'Disponible' },
        { value: 'critico', label: 'Crítico (≤ mínimo)' },
        { value: 'agotado', label: 'Agotado' },
      ],
      test: (p, v) => estadoDe(p) === v,
    },
    {
      key: 'ubicacion',
      label: 'Ubicación',
      options: [
        { value: 'suc', label: 'Con existencia en sucursal' },
        { value: 'sin-suc', label: 'Sin existencia en sucursal' },
        { value: 'bod', label: 'Con existencia en bodega' },
      ],
      test: (p, v) => (v === 'suc' ? p.stockSucursal > 0 : v === 'sin-suc' ? p.stockSucursal === 0 && p.stock > 0 : p.stockBodega > 0),
    },
  ];
  const activos = db.productos.filter((p) => p.activo);
  const f = useListFilters(activos, { search: (p) => [p.sku, p.nombre, p.marca, p.categoria, p.codigoBarras], selects });
  const pg = usePaged(f.filtered, f.key, 'inventario-existencias');
  const { openRecord } = useRecords();
  const ficha = (id: string) => openRecord('producto', id);
  const acciones = can('inventory:write') || can('prices:write');
  const columns: Column<Producto>[] = [
    { id: 'sku', label: 'SKU', required: true, cellClass: 'mono', cell: (p) => p.sku },
    {
      id: 'producto',
      label: 'Producto',
      required: true,
      cell: (p) => (
        <span className="prod-cell">
          <ProductImage src={p.imagen} size={28} fallback={p.ic} />
          <ProductRef id={p.id}>
            <button className="link-btn" onClick={() => ficha(p.id)} title="Ver ficha del producto">
              {p.nombre}
            </button>
          </ProductRef>
        </span>
      ),
    },
    { id: 'categoria', label: 'Categoría', cell: (p) => p.categoria || '—', hidden: true },
    { id: 'marca', label: 'Marca', cell: (p) => p.marca || '—', hidden: true },
    { id: 'bodega', label: 'Bodega', header: <span title="Bodega principal">Bodega</span>, className: 'num', cell: (p) => p.stockBodega },
    {
      id: 'sucursal',
      label: 'Sucursal',
      header: <span title="Sucursal principal (punto de venta)">Sucursal</span>,
      className: 'num',
      cell: (p) => p.stockSucursal,
      tdProps: (p) => (p.stock > 0 && p.stockSucursal === 0 ? { style: { color: 'var(--amber-deep)', fontWeight: 700 } } : {}),
    },
    { id: 'total', label: 'Total', className: 'num', cell: (p) => <b>{p.stock}</b> },
    { id: 'minimo', label: 'Mínimo', className: 'num', cell: (p) => p.stockMin },
    { id: 'maximo', label: 'Máximo', className: 'num', cell: (p) => p.stockMax ?? '—', hidden: true },
    { id: 'costo', label: 'Costo prom.', className: 'num', cell: (p) => money(p.costo) },
    { id: 'valor', label: 'Valor', className: 'num', cell: (p) => money(p.stock * p.costo), hidden: true },
    { id: 'precio', label: 'Precio', className: 'num', cell: (p) => (p.precio > 0 ? money(p.precio) : <span style={{ color: 'var(--muted)' }}>sin precio</span>) },
    { id: 'estado', label: 'Estado', cell: (p) => <StockTag stock={p.stock} min={p.stockMin} /> },
  ];
  const cols = useColumns('inventario-existencias', columns);
  const ncols = cols.visible.length + (acciones ? 1 : 0);

  const exportar = () =>
    exportCSV('existencias_por_ubicacion.csv', [
      ['SKU', 'Producto', 'Categoría', 'Marca', 'Bodega', 'Sucursal', 'Total', 'Mínimo', 'Costo promedio', 'Valor'],
      ...f.filtered.map((p) => [p.sku, p.nombre, p.categoria, p.marca, p.stockBodega, p.stockSucursal, p.stock, p.stockMin, p.costo.toFixed(2), (p.stock * p.costo).toFixed(2)]),
    ]);

  return (
    <>
      <FilterBar f={f} placeholder="Buscar por SKU, nombre, marca o código de barras…">
        <button className="b b-out" onClick={exportar} disabled={!f.filtered.length}>
          ⇩ CSV
        </button>
        <ColumnsButton cols={cols} />
      </FilterBar>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <ColumnHeads cols={cols} />
              {acciones && <th />}
            </tr>
          </thead>
          <tbody>
            {!activos.length && <EmptyRow cols={ncols} msg="Aún no hay productos activos" />}
            {!!activos.length && !f.filtered.length && <EmptyRow cols={ncols} msg="Ningún producto coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((p) => (
              <tr key={p.id}>
                <ColumnCells cols={cols} row={p} />
                {acciones && (
                  <td className="row-actions">
                    {can('inventory:write') && p.stock > 0 && (
                      <button
                        className="b b-out b-sm"
                        onClick={() => modal.open(<TransferFormModal productoId={p.id} origen={p.stockBodega > 0 ? BODEGA : SUCURSAL} />)}
                        title="Trasladar entre bodega y sucursal"
                      >
                        ⇄
                      </button>
                    )}
                    {can('prices:write') && (
                      <button className="b b-out b-sm" onClick={() => modal.open(<PriceModal producto={p} />)}>
                        Precio
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="productos" />
    </>
  );
}
