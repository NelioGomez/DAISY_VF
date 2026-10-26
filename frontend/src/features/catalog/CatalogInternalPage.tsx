/* MÓDULO: CATÁLOGO WEB — vista previa interna (RF-16) */
import { useNavigate } from 'react-router-dom';
import { ViewHead } from '../../components/common/ViewHead';
import { useData } from '../../store/hooks';
import { ProductCard } from './ProductCard';

export function CatalogInternalPage() {
  const { db } = useData();
  const navigate = useNavigate();
  return (
    <>
      <ViewHead
        title="Catálogo Web"
        desc="Vista previa del catálogo público que ven los clientes (RF-16)."
        actions={
          <button className="b b-amber" onClick={() => navigate('/catalogo')}>
            🌐 Abrir sitio público
          </button>
        }
      />
      <div className="cat-grid">
        {db.productos.filter((p) => p.activo).map((p) => (
          <ProductCard key={p.id} producto={p} variant="internal" />
        ))}
      </div>
    </>
  );
}
