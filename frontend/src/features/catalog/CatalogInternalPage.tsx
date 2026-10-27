/* MÓDULO: CATÁLOGO WEB — vista previa interna (RF-16) */
import { useNavigate } from 'react-router-dom';
import { ViewHead } from '../../components/common/ViewHead';
import { EmptyState } from '../../components/feedback/Empty';
import { useData } from '../../store/hooks';
import type { Producto } from '../../types';
import { ProductCard, type CatalogItem } from './ProductCard';

/** Misma regla que el backend (availabilityOf): agotado, pocas unidades (≤ mínimo) o disponible. */
const toItem = (p: Producto): CatalogItem => ({
  id: p.id,
  nombre: p.nombre,
  marca: p.marca,
  sku: p.sku,
  categoria: p.categoria,
  precio: p.precio,
  ic: p.ic,
  disponibilidad: p.stock <= 0 ? 'Agotado' : p.stock <= p.stockMin ? 'Pocas unidades' : 'Disponible',
});

export function CatalogInternalPage() {
  const { db } = useData();
  const navigate = useNavigate();
  const activos = db.productos.filter((p) => p.activo);
  return (
    <>
      <ViewHead
        title="Catálogo Web"
        desc="Vista previa de los productos activos tal como los ve el cliente (RF-16)."
        actions={
          <button className="b b-amber" onClick={() => navigate('/catalogo')}>
            🌐 Abrir sitio público
          </button>
        }
      />
      {activos.length ? (
        <div className="cat-grid">
          {activos.map((p) => (
            <ProductCard key={p.id} item={toItem(p)} variant="internal" />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState msg="No hay productos activos para mostrar" ic="📦" />
        </div>
      )}
    </>
  );
}
