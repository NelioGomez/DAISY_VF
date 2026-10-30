/* Portada del sitio público (mejora n.° 35). La pieza central es el "rótulo de
   precios" de las estaciones: cada categoría con su precio más bajo publicado. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { productos, whatsappUrl } from '../../services/public/publicService';
import type { ProductoPublico } from '../../types';
import { CategoryIcon } from './CategoryIcon';
import { ProductCard } from './ProductBits';
import { usePublicInfo } from './usePublicInfo';

const fmtLed = (n: number) => n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function HomePage() {
  usePageTitle(null);
  const { info, error } = usePublicInfo();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [top, setTop] = useState<ProductoPublico[] | null>(null);

  useEffect(() => {
    let alive = true;
    productos({ orden: 'vendidos', limit: 4 })
      .then((r) => alive && setTop(r.items))
      .catch(() => alive && setTop([]));
    return () => {
      alive = false;
    };
  }, []);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : '/catalogo');
  };

  const empresa = info?.empresa;

  return (
    <>
      <section className="pub-hero">
        <div className="pub-hero-in">
          <div className="pub-hero-copy">
            <h1>Repuestos y equipos para estaciones de servicio</h1>
            <p>
              Boquillas, mangueras, filtros, dispensadores, bombas y componentes eléctricos. Consulte precios y disponibilidad, arme su lista y reciba una cotización
              formal de nuestro equipo de ventas.
            </p>
            <form className="pub-hero-search" role="search" onSubmit={buscar}>
              <label htmlFor="hero-q" className="sr-only">
                Buscar productos
              </label>
              <input id="hero-q" type="search" placeholder="Buscar por nombre o código (SKU)" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
              <button type="submit" className="pub-btn pub-btn-amber">
                Buscar
              </button>
            </form>
            <div className="pub-hero-links">
              <Link to="/catalogo" className="pub-btn pub-btn-ghost">
                Ver todos los productos
              </Link>
              <a className="pub-btn pub-btn-ghost" href={whatsappUrl(empresa, 'Hola NORCOR, necesito una cotización.')} target="_blank" rel="noreferrer">
                Escribir por WhatsApp
              </a>
            </div>
          </div>

          <aside className="pub-totem" aria-labelledby="totem-title">
            <div className="pub-totem-head">
              <span className="pub-brand-mark is-small" aria-hidden="true">
                N
              </span>
              <div>
                <h2 id="totem-title">Precios desde</h2>
                <p>El precio más bajo publicado en cada categoría, en córdobas</p>
              </div>
            </div>
            <div className="pub-totem-face">
              {info ? (
                info.categorias.map((c) => (
                  <Link key={c.id} to={`/catalogo?cat=${c.id}`} className="pub-totem-row">
                    <span className="pub-totem-ic">
                      <CategoryIcon categoria={c.nombre} size={26} />
                    </span>
                    <span className="pub-totem-name">
                      {c.nombre}
                      <small>
                        {c.productos} {c.productos === 1 ? 'producto' : 'productos'}
                      </small>
                    </span>
                    <span className="pub-led">{c.desde === null ? '--' : fmtLed(c.desde)}</span>
                  </Link>
                ))
              ) : (
                <p className="pub-totem-wait">{error ? 'No se pudieron cargar las categorías.' : 'Cargando categorías…'}</p>
              )}
            </div>
            <Link to="/catalogo" className="pub-totem-foot">
              Ver el catálogo completo
            </Link>
          </aside>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-section-head">
          <div>
            <h2>Los más solicitados</h2>
            <p>Los productos que más venden nuestros clientes.</p>
          </div>
          <Link to="/catalogo?orden=vendidos" className="pub-textlink">
            Ver más
          </Link>
        </div>
        {top === null ? (
          <div className="pub-grid" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="pub-card is-skeleton" />
            ))}
          </div>
        ) : top.length ? (
          <div className="pub-grid">
            {top.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <p className="pub-muted">Aún no hay productos publicados.</p>
        )}
      </section>

      <section className="pub-section pub-steps-wrap" aria-labelledby="steps-title">
        <h2 id="steps-title">Cómo pedir una cotización</h2>
        <ol className="pub-steps">
          <li>
            <h3>Arme su lista</h3>
            <p>Agregue productos y cantidades desde el catálogo. Puede anotar la medida o el modelo de su surtidor en cada línea.</p>
          </li>
          <li>
            <h3>Envíela con su cuenta</h3>
            <p>Inicie sesión o cree su cuenta de cliente en un minuto. Su lista se conserva mientras tanto.</p>
          </li>
          <li>
            <h3>Reciba su cotización</h3>
            <p>Un vendedor confirma precios y disponibilidad. Verá la cotización y su estado en Mi cuenta.</p>
          </li>
        </ol>
      </section>

      {info && info.marcas.length > 0 && (
        <section className="pub-section pub-brands" aria-labelledby="brands-title">
          <h2 id="brands-title">Marcas que distribuimos</h2>
          <ul>
            {info.marcas.map((m) => (
              <li key={m.id}>
                <Link to={`/catalogo?marca=${m.id}`}>{m.nombre}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pub-band">
        <div className="pub-band-in">
          <div>
            <h2>¿No encuentra el repuesto que busca?</h2>
            <p>Envíenos el modelo del surtidor o una foto de la pieza y le ayudamos a identificarla.</p>
          </div>
          <div className="pub-band-actions">
            <a className="pub-btn pub-btn-amber" href={whatsappUrl(empresa, 'Hola NORCOR, busco un repuesto y quiero enviarles el modelo.')} target="_blank" rel="noreferrer">
              Escribir por WhatsApp
            </a>
            <Link to="/contacto" className="pub-btn pub-btn-ghost">
              Otras formas de contacto
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
