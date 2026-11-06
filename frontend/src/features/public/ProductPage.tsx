/* Ficha pública de producto (mejora n.° 36): imagen, nombre, SKU, marca, categoría, garantía
   (mejora n.° 60), precio vigente, disponibilidad, botón para cotizar y productos relacionados.
   Nunca muestra costos, proveedores, stock exacto ni movimientos. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ApiError, errorMessage } from '../../services/api/client';
import { producto, whatsappUrl } from '../../services/public/publicService';
import type { ProductoPublico } from '../../types';
import { plazoGarantia } from '../../utils/warranty';
import { useQuoteList } from '../portal/useCustomer';
import { AddToList, Availability, Price, ProductCard, ProductMedia } from './ProductBits';
import { usePublicInfo } from './usePublicInfo';

type Loaded = { id: string; producto: ProductoPublico; relacionados: ProductoPublico[] } | { id: string; error: string; notFound: boolean };

export function ProductPage() {
  const { id = '' } = useParams();
  const { info } = usePublicInfo();
  const lista = useQuoteList();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    producto(id)
      .then((r) => alive && setLoaded({ id, ...r }))
      .catch((e) => alive && setLoaded({ id, error: errorMessage(e), notFound: e instanceof ApiError && (e.status === 404 || e.status === 400) }));
    return () => {
      alive = false;
    };
  }, [id]);

  const current = loaded && loaded.id === id ? loaded : null;
  usePageTitle(current && 'producto' in current ? current.producto.nombre : 'Producto');

  if (!current)
    return (
      <div className="pub-product" aria-busy="true">
        <div className="pub-product-grid">
          <div className="pub-product-media is-skeleton" />
          <div className="pub-product-info">
            <div className="pub-skel-line" style={{ width: '40%' }} />
            <div className="pub-skel-line is-title" />
            <div className="pub-skel-line" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );

  if ('error' in current)
    return (
      <div className="pub-product">
        <div className="pub-empty">
          <h1>{current.notFound ? 'Este producto ya no está publicado' : 'No se pudo cargar el producto'}</h1>
          <p>{current.notFound ? 'Puede que se haya retirado del catálogo. Busque una alternativa o consúltenos por la pieza.' : current.error}</p>
          <Link to="/catalogo" className="pub-btn pub-btn-amber">
            Ver productos
          </Link>
        </div>
      </div>
    );

  const p = current.producto;
  const enLista = lista.lineas.find((l) => l.id === p.id);

  return (
    <div className="pub-product">
      <nav className="pub-crumbs" aria-label="Ruta">
        <Link to="/catalogo">Productos</Link>
        {p.categoriaId && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/catalogo?cat=${p.categoriaId}`}>{p.categoria}</Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{p.nombre}</span>
      </nav>

      <div className="pub-product-grid">
        <div className="pub-product-media">
          <ProductMedia p={p} size={150} />
        </div>

        <div className="pub-product-info">
          <h1>{p.nombre}</h1>
          <dl className="pub-specs">
            <div>
              <dt>Código (SKU)</dt>
              <dd className="pub-sku">{p.sku}</dd>
            </div>
            {p.marca && (
              <div>
                <dt>Marca</dt>
                <dd>{p.marca}</dd>
              </div>
            )}
            {p.categoria && (
              <div>
                <dt>Categoría</dt>
                <dd>{p.categoria}</dd>
              </div>
            )}
            <div>
              <dt>Unidad de venta</dt>
              <dd>{p.unidad.charAt(0).toUpperCase() + p.unidad.slice(1)}</dd>
            </div>
            {p.garantiaDias && (
              <div>
                <dt>Garantía</dt>
                <dd>{plazoGarantia(p.garantiaDias)} desde la compra</dd>
              </div>
            )}
          </dl>
          {p.garantiaDias && (
            <p className="pub-muted is-small">
              ¿Necesita hacer válida la garantía? <Link to="/contacto?motivo=servicio">Escríbanos</Link> con el número de su factura.
            </p>
          )}

          <div className="pub-buybox">
            <Price value={p.precio} unidad={p.unidad} />
            <Availability value={p.disponibilidad} withHelp />
            <AddToList p={p} big />
            {enLista && (
              <button type="button" className="pub-textlink" onClick={() => lista.setAbierta(true)}>
                Revisar y enviar mi lista
              </button>
            )}
            <p className="pub-buybox-note">El precio es de referencia; la cotización confirma precio, disponibilidad y plazo de entrega.</p>
            <a
              className="pub-btn pub-btn-line is-block"
              href={whatsappUrl(info?.empresa, `Hola NORCOR, quiero consultar por ${p.nombre} (código ${p.sku}).`)}
              target="_blank"
              rel="noreferrer"
            >
              Consultar por WhatsApp
            </a>
          </div>

          {p.descripcion && (
            <section className="pub-desc" aria-labelledby="desc-title">
              <h2 id="desc-title">Descripción</h2>
              <p>{p.descripcion}</p>
            </section>
          )}
        </div>
      </div>

      {current.relacionados.length > 0 && (
        <section className="pub-related" aria-labelledby="rel-title">
          <div className="pub-section-head">
            <h2 id="rel-title">También en {p.categoria}</h2>
            {p.categoriaId && (
              <Link to={`/catalogo?cat=${p.categoriaId}`} className="pub-textlink">
                Ver la categoría
              </Link>
            )}
          </div>
          <div className="pub-grid">
            {current.relacionados.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
