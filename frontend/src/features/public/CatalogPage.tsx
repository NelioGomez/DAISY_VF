/* Productos (mejora n.° 35): búsqueda, filtros por categoría, marca, disponibilidad
   y rango de precio, orden y paginación del servidor. Los filtros viven en la URL
   para que el botón Atrás y los enlaces compartidos funcionen. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { errorMessage, type Pagination } from '../../services/api/client';
import { productos, type FiltroCatalogo, type Orden } from '../../services/public/publicService';
import type { Disponibilidad, ProductoPublico } from '../../types';
import { ProductCard } from './ProductBits';
import { usePublicInfo } from './usePublicInfo';

const ORDENES: Array<[Orden, string]> = [
  ['nombre', 'Nombre (A a Z)'],
  ['precio-asc', 'Precio: menor a mayor'],
  ['precio-desc', 'Precio: mayor a menor'],
  ['vendidos', 'Más vendidos'],
];

const DISPONIBILIDADES: Disponibilidad[] = ['Disponible', 'Pocas unidades', 'Bajo pedido'];
const PER_PAGE = 12;

const toNum = (v: string | null) => (v !== null && v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);

function readFilter(sp: URLSearchParams): FiltroCatalogo {
  const orden = sp.get('orden') as Orden | null;
  const disp = sp.get('disp') as Disponibilidad | null;
  return {
    q: sp.get('q') ?? '',
    categoria: sp.get('cat') ?? undefined,
    marca: sp.get('marca') ?? undefined,
    disponibilidad: disp && DISPONIBILIDADES.includes(disp) ? disp : undefined,
    min: toNum(sp.get('min')),
    max: toNum(sp.get('max')),
    orden: orden && ORDENES.some(([o]) => o === orden) ? orden : 'nombre',
    page: Math.max(1, Math.floor(toNum(sp.get('p')) ?? 1)),
    limit: PER_PAGE,
  };
}

type Loaded = { key: string; items: ProductoPublico[]; pagination: Pagination } | { key: string; error: string };

export function CatalogPage() {
  usePageTitle('Productos');
  const { info } = usePublicInfo();
  const [sp, setSp] = useSearchParams();
  const key = sp.toString();
  const f = readFilter(sp);
  const [attempt, setAttempt] = useState(0);
  const reqKey = `${key}#${attempt}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Campo de búsqueda y precios: se editan localmente y se aplican al enviar.
  const [draft, setDraft] = useState({ key, q: f.q ?? '', min: sp.get('min') ?? '', max: sp.get('max') ?? '' });
  const form = draft.key === key ? draft : { key, q: f.q ?? '', min: sp.get('min') ?? '', max: sp.get('max') ?? '' };
  const edit = (patch: Partial<typeof form>) => setDraft({ ...form, ...patch });

  useEffect(() => {
    let alive = true;
    productos(readFilter(new URLSearchParams(reqKey.split('#')[0])))
      .then((r) => alive && setLoaded({ key: reqKey, ...r }))
      .catch((e) => alive && setLoaded({ key: reqKey, error: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [reqKey]);

  /** Cambia filtros y vuelve a la página 1 (salvo que se cambie la página misma). */
  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('p' in patch)) next.delete('p');
    else window.scrollTo({ top: 0 });
    setSp(next);
  };

  const aplicarBusqueda = (e: FormEvent) => {
    e.preventDefault();
    update({ q: form.q.trim() || undefined });
  };

  const aplicarPrecio = (e: FormEvent) => {
    e.preventDefault();
    let min = toNum(form.min);
    let max = toNum(form.max);
    if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
    update({ min: min?.toString(), max: max?.toString() });
  };

  const current = loaded && loaded.key === reqKey ? loaded : null;
  const cat = info?.categorias.find((c) => c.id === f.categoria);
  const marca = info?.marcas.find((m) => m.id === f.marca);
  const activos = [
    f.q && { k: 'q', label: `“${f.q}”` },
    cat && { k: 'cat', label: cat.nombre },
    marca && { k: 'marca', label: marca.nombre },
    f.disponibilidad && { k: 'disp', label: f.disponibilidad },
    (f.min !== undefined || f.max !== undefined) && {
      k: 'precio',
      label: f.min !== undefined && f.max !== undefined ? `C$ ${f.min} a ${f.max}` : f.min !== undefined ? `Desde C$ ${f.min}` : `Hasta C$ ${f.max}`,
    },
  ].filter(Boolean) as Array<{ k: string; label: string }>;

  const quitar = (k: string) => update(k === 'precio' ? { min: undefined, max: undefined } : { [k]: undefined });

  return (
    <div className="pub-catalog">
      <div className="pub-catalog-head">
        <div>
          <h1>{cat ? cat.nombre : 'Productos'}</h1>
          <p className="pub-muted" aria-live="polite">
            {current && 'pagination' in current ? `${current.pagination.total} ${current.pagination.total === 1 ? 'producto' : 'productos'}` : ' '}
          </p>
        </div>
        <form className="pub-searchbar" role="search" onSubmit={aplicarBusqueda}>
          <label htmlFor="cat-q" className="sr-only">
            Buscar productos
          </label>
          <input id="cat-q" type="search" placeholder="Buscar por nombre, código o descripción" value={form.q} maxLength={100} onChange={(e) => edit({ q: e.target.value })} />
          <button type="submit" className="pub-btn pub-btn-dark">
            Buscar
          </button>
        </form>
        <label className="pub-sort">
          <span>Ordenar por</span>
          <select value={f.orden} onChange={(e) => update({ orden: e.target.value === 'nombre' ? undefined : e.target.value })}>
            {ORDENES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pub-catalog-body">
        <aside className={`pub-filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filtros">
          <button type="button" className="pub-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
            Filtros{activos.length ? ` (${activos.length})` : ''}
          </button>
          <div className="pub-filters-body">
            <fieldset>
              <legend>Categoría</legend>
              <FilterOption name="cat" checked={!f.categoria} onChange={() => update({ cat: undefined })} label="Todas" />
              {info?.categorias.map((c) => (
                <FilterOption key={c.id} name="cat" checked={f.categoria === c.id} onChange={() => update({ cat: c.id })} label={c.nombre} count={c.productos} />
              ))}
            </fieldset>

            {info && info.marcas.length > 0 && (
              <fieldset>
                <legend>Marca</legend>
                <FilterOption name="marca" checked={!f.marca} onChange={() => update({ marca: undefined })} label="Todas" />
                {info.marcas.map((m) => (
                  <FilterOption key={m.id} name="marca" checked={f.marca === m.id} onChange={() => update({ marca: m.id })} label={m.nombre} />
                ))}
              </fieldset>
            )}

            <fieldset>
              <legend>Disponibilidad</legend>
              <FilterOption name="disp" checked={!f.disponibilidad} onChange={() => update({ disp: undefined })} label="Cualquiera" />
              {DISPONIBILIDADES.map((d) => (
                <FilterOption key={d} name="disp" checked={f.disponibilidad === d} onChange={() => update({ disp: d })} label={d} />
              ))}
            </fieldset>

            <form onSubmit={aplicarPrecio}>
              <fieldset>
                <legend>Precio (C$)</legend>
                <div className="pub-range">
                  <label>
                    <span className="sr-only">Precio mínimo</span>
                    <input type="number" min={0} step="any" inputMode="decimal" placeholder="Mínimo" value={form.min} onChange={(e) => edit({ min: e.target.value })} />
                  </label>
                  <span aria-hidden="true">a</span>
                  <label>
                    <span className="sr-only">Precio máximo</span>
                    <input type="number" min={0} step="any" inputMode="decimal" placeholder="Máximo" value={form.max} onChange={(e) => edit({ max: e.target.value })} />
                  </label>
                </div>
                <button type="submit" className="pub-btn pub-btn-line is-small">
                  Aplicar precio
                </button>
              </fieldset>
            </form>
          </div>
        </aside>

        <section className="pub-results" aria-label="Resultados">
          {activos.length > 0 && (
            <div className="pub-chips">
              {activos.map((a) => (
                <button key={a.k} type="button" className="pub-chip" onClick={() => quitar(a.k)} aria-label={`Quitar filtro ${a.label}`}>
                  {a.label} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button type="button" className="pub-textlink" onClick={() => setSp(new URLSearchParams(f.orden !== 'nombre' ? { orden: f.orden ?? '' } : {}))}>
                Limpiar filtros
              </button>
            </div>
          )}

          {!current ? (
            <div className="pub-grid" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="pub-card is-skeleton" />
              ))}
            </div>
          ) : 'error' in current ? (
            <div className="pub-empty" role="alert">
              <h2>No se pudo cargar el catálogo</h2>
              <p>{current.error}</p>
              <button type="button" className="pub-btn pub-btn-line" onClick={() => setAttempt((n) => n + 1)}>
                Intentar de nuevo
              </button>
            </div>
          ) : current.items.length === 0 ? (
            <div className="pub-empty">
              <h2>No hay productos con estos filtros</h2>
              <p>Pruebe con otra palabra o quite algún filtro. Si no encuentra la pieza, escríbanos y la buscamos por usted.</p>
              <Link to="/contacto" className="pub-btn pub-btn-line">
                Consultar por una pieza
              </Link>
            </div>
          ) : (
            <>
              <div className="pub-grid">
                {current.items.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
              {current.pagination.totalPages > 1 && (
                <nav className="pub-pages" aria-label="Páginas">
                  <button type="button" className="pub-btn pub-btn-line" disabled={current.pagination.page <= 1} onClick={() => update({ p: String(current.pagination.page - 1) })}>
                    Anterior
                  </button>
                  <span>
                    Página {current.pagination.page} de {current.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="pub-btn pub-btn-line"
                    disabled={current.pagination.page >= current.pagination.totalPages}
                    onClick={() => update({ p: String(current.pagination.page + 1) })}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterOption({ name, label, checked, onChange, count }: { name: string; label: string; checked: boolean; onChange(): void; count?: number }) {
  return (
    <label className={`pub-opt ${checked ? 'is-on' : ''}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
      {count !== undefined && <small>{count}</small>}
    </label>
  );
}
