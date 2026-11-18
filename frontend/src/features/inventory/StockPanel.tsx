/* Existencias por producto con su reparto entre bodega y sucursal (mejora n.° 23), filtros con
   chips (n.° 18 y 19), paginación (n.° 20) y encabezado fijo (n.° 22). */
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
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
import { ProductDrawer } from '../products/ProductDrawer';
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
  const ficha = (id: string) => modal.open(<ProductDrawer productoId={id} />);

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
      </FilterBar>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th className="num" title="Bodega principal">
                Bodega
              </th>
              <th className="num" title="Sucursal principal (punto de venta)">
                Sucursal
              </th>
              <th className="num">Total</th>
              <th className="num">Mínimo</th>
              <th className="num">Costo prom.</th>
              <th className="num">Precio</th>
              <th>Estado</th>
              {(can('inventory:write') || can('prices:write')) && <th />}
            </tr>
          </thead>
          <tbody>
            {!activos.length && <EmptyRow cols={10} msg="Aún no hay productos activos" />}
            {!!activos.length && !f.filtered.length && <EmptyRow cols={10} msg="Ningún producto coincide con los filtros" ic="🔍" />}
            {pg.pageRows.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.sku}</td>
                <td>
                  <button className="link-btn" onClick={() => ficha(p.id)} title="Ver ficha del producto">
                    {p.ic} {p.nombre}
                  </button>
                </td>
                <td className="num">{p.stockBodega}</td>
                <td className="num" style={p.stock > 0 && p.stockSucursal === 0 ? { color: 'var(--amber-deep)', fontWeight: 700 } : undefined}>
                  {p.stockSucursal}
                </td>
                <td className="num">
                  <b>{p.stock}</b>
                </td>
                <td className="num">{p.stockMin}</td>
                <td className="num">{money(p.costo)}</td>
                <td className="num">{p.precio > 0 ? money(p.precio) : <span style={{ color: 'var(--muted)' }}>sin precio</span>}</td>
                <td>
                  <StockTag stock={p.stock} min={p.stockMin} />
                </td>
                {(can('inventory:write') || can('prices:write')) && (
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
