/* Vista rápida del catálogo público (mejora n.° 34): foto, precio, disponibilidad y descripción
   del producto en una ventana, para agregarlo a la lista o compararlo sin salir del catálogo. */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { quickView, useQuickView } from './compareStore';
import { AddToList, Availability, CompareToggle, Price, ProductMedia } from './ProductBits';

export function QuickView() {
  const p = useQuickView();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (p && !d.open) {
      // showModal: el foco queda dentro, Esc cierra y el fondo no responde.
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!p && d.open) d.close();
  }, [p]);

  return (
    <dialog
      ref={dialog}
      className="pub-qv"
      aria-labelledby="pub-qv-title"
      onClose={() => quickView.close()}
      onClick={(e) => e.target === e.currentTarget && quickView.close()}
    >
      {p && (
        <div className="pub-qv-in">
          <button type="button" className="pub-qv-x" onClick={() => quickView.close()} aria-label="Cerrar vista rápida">
            ×
          </button>
          <div className="pub-qv-media">
            <ProductMedia p={p} size={88} />
          </div>
          <div className="pub-qv-body">
            <div className="pub-card-meta">
              {p.marca && <span>{p.marca}</span>}
              <span className="pub-sku">{p.sku}</span>
            </div>
            <h2 id="pub-qv-title">{p.nombre}</h2>
            {p.categoria && <p className="pub-qv-cat">{p.categoria}</p>}
            <Price value={p.precio} unidad={p.unidad} />
            <Availability value={p.disponibilidad} withHelp />
            {p.descripcion && p.descripcion !== p.nombre && <p className="pub-qv-desc">{p.descripcion}</p>}
            <AddToList p={p} big />
            <div className="pub-qv-foot">
              <CompareToggle p={p} />
              <Link to={`/catalogo/${p.id}`} className="pub-textlink" onClick={() => quickView.close()}>
                Ver ficha completa →
              </Link>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
