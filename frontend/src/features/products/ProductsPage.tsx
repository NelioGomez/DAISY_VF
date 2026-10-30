/* MÓDULO: PRODUCTOS (RF-03) */
import { useState } from 'react';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyRow } from '../../components/feedback/Empty';
import { useModal } from '../../components/modals/useModal';
import { SearchToolbar } from '../../components/tables/SearchToolbar';
import { Tag } from '../../components/tables/Tag';
import { useAuth, useData } from '../../store/hooks';
import { matches, money } from '../../utils/format';
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
  const [q, setQ] = useState('');
  const rows = db.productos.filter((p) => matches(q, p.sku, p.nombre, p.marca, p.categoria));

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
      <SearchToolbar value={q} onChange={setQ} placeholder="Buscar por nombre, SKU, marca o categoría…" />
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
            {rows.map((p) => {
              const crit = p.stock <= p.stockMin;
              return (
                <tr key={p.id} className="row-link" onClick={() => modal.open(<ProductDrawer productoId={p.id} />)}>
                  <td className="mono">{p.sku}</td>
                  <td>
                    {p.ic} {p.nombre}
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
    </>
  );
}
