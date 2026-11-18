/* MÓDULO: PRODUCTOS (RF-03) — filtros con chips y paginación (mejoras n.° 18-20). */
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { FilterBar } from '../../components/tables/FilterBar';
import { Pagination } from '../../components/tables/Pagination';
import { Tag } from '../../components/tables/Tag';
import { useListFilters, type SelectFilter } from '../../hooks/useListFilters';
import { usePaged } from '../../hooks/usePaged';
import { useAuth, useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { money } from '../../utils/format';
import { PriceModal } from './PriceModal';
import { ProductDrawer } from './ProductDrawer';
import { ProductFormModal } from './ProductFormModal';
import { useExportProductos } from './useExportProductos';

export function ProductsPage() {
  const { db } = useData();
  const { can } = useAuth();
  const canWrite = can('products:write');
  const canPrice = can('prices:write');
  const modal = useModal();
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
      <FilterBar f={f} placeholder="Buscar por nombre, SKU, marca, categoría o código de barras…" />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Marca</th>
              <th>Categoría</th>
              <th className="num">Costo prom.</th>
              <th className="num">Precio</th>
              <th className="num">Stock</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!db.productos.length && <EmptyRow cols={9} msg="Sin productos" />}
            {!!db.productos.length && !f.filtered.length && <EmptyRow cols={9} msg="Ningún producto coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((p) => {
              const crit = p.stock <= p.stockMin;
              return (
                <tr key={p.id} className="row-link" onClick={() => modal.open(<ProductDrawer productoId={p.id} />)}>
                  <td className="mono">{p.sku}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {p.imagen ? (
                        <img src={p.imagen} alt="" loading="lazy" style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />
                      ) : (
                        <span>{p.ic}</span>
                      )}
                      <span>{p.nombre}</span>
                    </span>
                  </td>
                  <td>{p.marca}</td>
                  <td>
                    <Tag>{p.categoria}</Tag>
                  </td>
                  <td className="num">{money(p.costo)}</td>
                  <td className="num">{money(p.precio)}</td>
                  <td className="num" style={crit ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                    {p.stock}
                    {crit && ' ▼'}
                  </td>
                  <td>{p.activo ? <Tag tone="t-green">Activo</Tag> : <Tag>Inactivo</Tag>}</td>
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
