/* MÓDULO: PRODUCTOS (RF-03) — filtros con chips y paginación (mejoras n.° 18-20), foto (n.° 4),
   columnas configurables (n.° 21), ficha en panel lateral con dirección propia (n.° 32-33) y
   vista previa al pasar el cursor por el nombre (n.° 34). */
import { ProductImage } from '../../components/common/ProductImage';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { ColumnCells, ColumnHeads, ColumnsButton } from '../../components/tables/columns';
import { useColumns, type Column } from '../../components/tables/useColumns';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { money } from '../../utils/format';
import { useRecords } from '../records/records';
import { PriceModal } from './PriceModal';
import { ProductFormModal } from './ProductFormModal';
import { ProductRef } from './ProductRef';
import { useExportProductos } from './useExportProductos';

export function ProductsPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('products:write');
  const canPrice = can('prices:write');
  const modal = useModal();
  const { openRecord } = useRecords();
  const exportProductos = useExportProductos();
  const selects: SelectFilter<Producto>[] = [
    { key: 'categoria', label: 'Categoría', options: db.categorias.map((c) => ({ value: c.id, label: c.nombre })), test: (p, v) => p.categoriaId === v },
    { key: 'marca', label: 'Marca', options: db.marcas.map((m) => ({ value: m.id, label: m.nombre })), test: (p, v) => p.marcaId === v },
    {
      key: 'estado',
      label: 'Estado',
      options: [
        { value: 'activo', label: 'Activos' },
        { value: 'inactivo', label: 'Inactivos' },
      ],
      test: (p, v) => (v === 'activo' ? p.activo : !p.activo),
    },
    {
      key: 'stock',
      label: 'Stock',
      options: [
        { value: 'critico', label: 'Crítico (≤ mínimo)' },
        { value: 'agotado', label: 'Agotado' },
        { value: 'ok', label: 'Sobre el mínimo' },
      ],
      test: (p, v) => (v === 'agotado' ? p.stock <= 0 : v === 'critico' ? p.stock <= p.stockMin : p.stock > p.stockMin),
    },
    {
      key: 'precio',
      label: 'Precio',
      options: [
        { value: 'sin', label: 'Sin precio comercial' },
        { value: 'con', label: 'Con precio' },
      ],
      test: (p, v) => (v === 'sin' ? p.precio <= 0 : p.precio > 0),
    },
  ];
  const f = useListFilters(db.productos, { search: (p) => [p.sku, p.nombre, p.marca, p.categoria, p.codigoBarras], selects });
  const pg = usePaged(f.filtered, f.key, 'productos');
  const columns: Column<Producto>[] = [
    { id: 'sku', label: 'SKU', cellClass: 'mono', cell: (p) => p.sku, required: true },
    {
      id: 'producto',
      label: 'Producto',
      required: true,
      cell: (p) => (
        <span className="prod-cell">
          <ProductImage src={p.imagen} size={34} fallback={p.ic} />
          <ProductRef id={p.id}>
            <button type="button" className="link-btn" onClick={(e) => {
                e.stopPropagation();
                openRecord('producto', p.id);
              }}>
              {p.nombre}
            </button>
          </ProductRef>
        </span>
      ),
    },
    { id: 'marca', label: 'Marca', cell: (p) => p.marca },
    { id: 'categoria', label: 'Categoría', cell: (p) => <Tag>{p.categoria}</Tag> },
    { id: 'barras', label: 'Código de barras', cellClass: 'mono', cell: (p) => p.codigoBarras || '—', hidden: true },
    { id: 'costo', label: 'Costo prom.', className: 'num', cell: (p) => money(p.costo) },
    { id: 'precio', label: 'Precio', className: 'num', cell: (p) => money(p.precio) },
    {
      id: 'stock',
      label: 'Stock',
      className: 'num',
      cell: (p) => (
        <>
          {p.stock}
          {p.stock <= p.stockMin && ' ▼'}
        </>
      ),
      tdProps: (p) => (p.stock <= p.stockMin ? { style: { color: 'var(--red)', fontWeight: 700 } } : {}),
    },
    { id: 'bodega', label: 'En bodega', className: 'num', cell: (p) => p.stockBodega, hidden: true },
    { id: 'sucursal', label: 'En sucursal', className: 'num', cell: (p) => p.stockSucursal, hidden: true },
    { id: 'minimo', label: 'Mínimo', className: 'num', cell: (p) => p.stockMin, hidden: true },
    { id: 'estado', label: 'Estado', cell: (p) => (p.activo ? <Tag tone="t-green">Activo</Tag> : <Tag>Inactivo</Tag>) },
  ];
  const cols = useColumns('productos', columns);
  const ncols = cols.visible.length + 1;

  return (
    <>
      <ViewHead
        title="Productos"
        desc="Catálogo maestro de repuestos. El stock y el costo promedio los calcula el servidor a partir de los movimientos de inventario. Haga clic en un producto para ver su ficha completa."
        actions={
          <>
            <button className="b b-out" onClick={exportProductos}>
              ⬇ Exportar CSV
            </button>
            {canWrite && (
              <button className="b b-amber" onClick={() => modal.open(<ProductFormModal />)}>
                + Nuevo producto
              </button>
            )}
          </>
        }
      />
      <FilterBar f={f} placeholder="Buscar por nombre, SKU, marca, categoría o código de barras…">
        <ColumnsButton cols={cols} />
      </FilterBar>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <ColumnHeads cols={cols} />
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.productos.length && <EmptyRow cols={ncols} msg="Sin productos" />}
            {!!db.productos.length && !f.filtered.length && <EmptyRow cols={ncols} msg="Ningún producto coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((p) => {
              return (
                <tr key={p.id} className="row-link" onClick={() => openRecord('producto', p.id)}>
                  <ColumnCells cols={cols} row={p} />
                  <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {canWrite && (
                      <button className="b b-out b-sm" onClick={() => modal.open(<ProductFormModal producto={p} />)}>
                        Editar
                      </button>
                    )}{' '}
                    {canPrice && (
                      <button className="b b-out b-sm" onClick={() => modal.open(<PriceModal producto={p} />)} title="Precio comercial e historial">
                        Precio
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination p={pg} label="productos" />
    </>
  );
}
