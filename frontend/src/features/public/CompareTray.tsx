/* Barra del comparador (mejora n.° 38): aparece al marcar productos y lleva a la comparación. */
import { Link, useLocation } from 'react-router-dom';
import { MAX_COMPARE, useCompare } from './compareStore';
import { ProductMedia } from './ProductBits';

export function CompareTray() {
  const cmp = useCompare();
  const { pathname } = useLocation();
  if (!cmp.items.length || pathname === '/catalogo/comparar') return null;
  const ids = cmp.items.map((x) => x.id).join(',');
  return (
    <aside className="pub-tray" aria-label="Productos para comparar">
      <div className="pub-tray-in">
        <ul className="pub-tray-list">
          {cmp.items.map((x) => (
            <li key={x.id}>
              <span className="pub-tray-media">
                <ProductMedia p={x} size={22} />
              </span>
              <span className="pub-tray-name" title={x.nombre}>
                {x.nombre}
              </span>
              <button type="button" onClick={() => cmp.remove(x.id)} aria-label={`Quitar ${x.nombre} de la comparación`}>
                ×
              </button>
            </li>
          ))}
          {Array.from({ length: MAX_COMPARE - cmp.items.length }, (_, i) => (
            <li key={`v${i}`} className="is-empty" aria-hidden="true" />
          ))}
        </ul>
        <div className="pub-tray-actions">
          <button type="button" className="pub-textlink" onClick={cmp.clear}>
            Limpiar
          </button>
          {cmp.items.length >= 2 ? (
            <Link to={`/catalogo/comparar?ids=${ids}`} className="pub-btn pub-btn-amber">
              Comparar ({cmp.items.length})
            </Link>
          ) : (
            <span className="pub-tray-hint">Elija otro producto para comparar</span>
          )}
        </div>
      </div>
    </aside>
  );
}
