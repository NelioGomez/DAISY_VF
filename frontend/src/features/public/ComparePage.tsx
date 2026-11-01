/* Comparador de productos (mejora n.° 38): hasta 4 productos lado a lado con foto, precio,
   disponibilidad, marca, categoría, unidad y descripción. Resalta lo que cambia entre ellos y el
   menor precio. La dirección (?ids=…) se puede compartir. */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage } from '../../services/api/client';
import { comparar } from '../../services/public/publicService';
import type { ProductoPublico } from '../../types';
import { compareStore, MAX_COMPARE, useCompare } from './compareStore';
import { AddToList, Availability, Price, ProductMedia } from './ProductBits';

type Loaded = { key: string; items: ProductoPublico[]; faltan: string[]; diferencias: string[]; menorPrecio: number | null } | { key: string; error: string };

interface Row {
  key: string;
  label: string;
  /** Campo de la API para saber si cambia entre productos (null = no se resalta). */
  diff: string | null;
  cell: (p: ProductoPublico) => ReactNode;
}

export function ComparePage() {
  usePageTitle('Comparar productos');
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const cmp = useCompare();
  const fromUrl = (sp.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX_COMPARE);
  const ids = fromUrl.length ? fromUrl : cmp.items.map((x) => x.id);
  const key = ids.join(',');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [soloDiferencias, setSoloDiferencias] = useState(false);
  const [resaltar, setResaltar] = useState(true);

  useEffect(() => {
    if (ids.length < 2) return;
    let alive = true;
    comparar(ids)
      .then((r) => {
        if (!alive) return;
        r.faltan.forEach((id) => compareStore.remove(id));
        setLoaded({ key, ...r });
      })
      .catch((e) => alive && setLoaded({ key, error: errorMessage(e) }));
    return () => {
      alive = false;
    };
    // ids se deriva de key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const quitar = (id: string) => {
    cmp.remove(id);
    const rest = ids.filter((x) => x !== id);
    navigate(rest.length ? `/catalogo/comparar?ids=${rest.join(',')}` : '/catalogo/comparar', { replace: true });
  };

  if (ids.length < 2)
    return (
      <div className="pub-wrap pub-compare-page">
        <h1 className="pub-title">Comparar productos</h1>
        <div className="pub-empty">
          <h2>Elija al menos dos productos</h2>
          <p>En el catálogo, marque «Comparar» en hasta {MAX_COMPARE} productos y vuelva aquí para verlos lado a lado.</p>
          <Link to="/catalogo" className="pub-btn pub-btn-amber">
            Ir al catálogo
          </Link>
        </div>
      </div>
    );

  const current = loaded && loaded.key === key ? loaded : null;
  const rows: Row[] = current && 'items' in current ? buildRows(current.menorPrecio) : [];
  const diferencias = current && 'items' in current ? current.diferencias : [];
  const visibles = soloDiferencias ? rows.filter((r) => r.diff && diferencias.includes(r.diff)) : rows;

  return (
    <div className="pub-wrap pub-compare-page">
      <div className="pub-compare-head">
        <div>
          <h1 className="pub-title">Comparar productos</h1>
          <p className="pub-lead">Características de cada producto, lado a lado. Lo que cambia entre ellos queda resaltado.</p>
        </div>
        <div className="pub-compare-opts">
          <label>
            <input type="checkbox" checked={resaltar} onChange={(e) => setResaltar(e.target.checked)} /> Resaltar diferencias
          </label>
          <label>
            <input type="checkbox" checked={soloDiferencias} onChange={(e) => setSoloDiferencias(e.target.checked)} /> Solo lo que cambia
          </label>
          <Link to="/catalogo" className="pub-textlink">
            ← Seguir viendo productos
          </Link>
        </div>
      </div>

      {!current ? (
        <div className="pub-card is-skeleton" aria-busy="true" style={{ minHeight: 360 }} />
      ) : 'error' in current ? (
        <div className="pub-empty" role="alert">
          <h2>No se pudo cargar la comparación</h2>
          <p>{current.error}</p>
          <button
            type="button"
            className="pub-btn pub-btn-line"
            onClick={() => {
              setLoaded(null);
              setAttempt((n) => n + 1);
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      ) : (
        <>
          {current.faltan.length > 0 && (
            <p className="pub-note" role="status">
              {current.faltan.length === 1 ? 'Un producto ya no está publicado y' : `${current.faltan.length} productos ya no están publicados y`} se quitó de la comparación.
            </p>
          )}
          <div className="pub-compare-scroll">
            <table className={`pub-compare-table ${resaltar ? 'show-diff' : ''}`}>
              <caption className="sr-only">Comparación de {current.items.length} productos</caption>
              <thead>
                <tr>
                  <th scope="col" className="pub-compare-corner">
                    <span className="sr-only">Característica</span>
                  </th>
                  {current.items.map((p) => (
                    <th key={p.id} scope="col">
                      <div className="pub-compare-prod">
                        <Link to={`/catalogo/${p.id}`} className="pub-compare-media" tabIndex={-1} aria-hidden="true">
                          <ProductMedia p={p} size={64} />
                        </Link>
                        <Link to={`/catalogo/${p.id}`} className="pub-compare-name">
                          {p.nombre}
                        </Link>
                        <button type="button" className="pub-textlink" onClick={() => quitar(p.id)} aria-label={`Quitar ${p.nombre} de la comparación`}>
                          Quitar
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.key} className={r.diff && diferencias.includes(r.diff) ? 'is-diff' : undefined}>
                    <th scope="row">
                      {r.label}
                      {r.diff && diferencias.includes(r.diff) && <span className="pub-diff-dot" title="Cambia entre los productos" aria-label="(cambia)" />}
                    </th>
                    {current.items.map((p) => (
                      <td key={p.id}>{r.cell(p)}</td>
                    ))}
                  </tr>
                ))}
                {soloDiferencias && !visibles.length && (
                  <tr>
                    <td colSpan={current.items.length + 1} className="pub-compare-same">
                      Estos productos coinciden en precio, marca, categoría, unidad y disponibilidad.
                    </td>
                  </tr>
                )}
                <tr className="pub-compare-actions">
                  <th scope="row">Cotizar</th>
                  {current.items.map((p) => (
                    <td key={p.id}>
                      <AddToList p={p} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function buildRows(menorPrecio: number | null): Row[] {
  return [
    {
      key: 'precio',
      label: 'Precio',
      diff: 'price',
      cell: (p) => (
        <>
          <Price value={p.precio} unidad={p.unidad} />
          {p.precio !== null && p.precio === menorPrecio && <span className="pub-best">Menor precio</span>}
        </>
      ),
    },
    { key: 'disp', label: 'Disponibilidad', diff: 'availability', cell: (p) => <Availability value={p.disponibilidad} /> },
    { key: 'marca', label: 'Marca', diff: 'brand', cell: (p) => p.marca || '—' },
    { key: 'categoria', label: 'Categoría', diff: 'category', cell: (p) => p.categoria || '—' },
    { key: 'unidad', label: 'Se vende por', diff: 'unit', cell: (p) => p.unidad },
    { key: 'sku', label: 'Código (SKU)', diff: null, cell: (p) => <span className="pub-sku">{p.sku}</span> },
    { key: 'desc', label: 'Descripción', diff: null, cell: (p) => (p.descripcion && p.descripcion !== p.nombre ? p.descripcion : '—') },
  ];
}
