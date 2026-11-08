/* MÓDULO: DOCUMENTACIÓN — manual de usuario (mejora n.° 64)
   Todos los roles lo ven. Índice por grupos (los módulos que su rol no abre se marcan con un
   candado, pero se pueden leer), búsqueda en todo el manual sin importar tildes, capítulos con
   imágenes que se amplían con un clic, "En este capítulo", anterior / siguiente e impresión.
   La dirección lleva el capítulo y la sección (/app/documentacion?cap=ordenes#facturar-la-orden),
   así que se puede compartir; el botón de ayuda de la barra superior abre el capítulo de la
   pantalla en que se está. "Imprimir todo el manual" arma una versión con portada, índice y los 25
   capítulos seguidos (cada uno en página nueva) y abre la impresión. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/common/Icon';
import { ViewHead } from '../../components/common/ViewHead';
import { ACCESS, ROLES, visibleModules } from '../../config/navigation';
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuth } from '../../store/hooks';
import type { RoleKey } from '../../types';
import { buscar, CAPITULOS, GRUPOS, type Capitulo } from './manual';
import { Inline, Markdown } from './Markdown';

const rolesDe = (cap: Capitulo): RoleKey[] => (cap.modulo ? (Object.keys(ACCESS) as RoleKey[]).filter((r) => ACCESS[r].includes(cap.modulo!)) : []);

export function DocsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [todo, setTodo] = useState(false);
  const todoRef = useRef<HTMLDivElement>(null);
  const toc = useRef<HTMLDetailsElement>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const permitidos = useMemo(() => new Set(user ? visibleModules(user) : []), [user]);

  const cap = CAPITULOS.find((c) => c.id === params.get('cap')) ?? CAPITULOS[0];
  const idx = CAPITULOS.indexOf(cap);
  const anterior = CAPITULOS[idx - 1];
  const siguiente = CAPITULOS[idx + 1];
  const resultados = useMemo(() => buscar(q), [q]);
  const subtitulos = cap.blocks.filter((b): b is Extract<typeof b, { t: 'h' }> => b.t === 'h' && b.level === 2);
  const roles = rolesDe(cap);
  const sinAcceso = !!cap.modulo && !permitidos.has(cap.modulo);

  // Al cambiar de capítulo se sube al inicio; con #sección se baja hasta ella.
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    const el = id ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.focus({ preventScroll: true });
    } else window.scrollTo(0, 0);
  }, [cap.id, hash]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  // Imprimir todo: se espera a que carguen las imágenes de todos los capítulos y se abre la impresión.
  useEffect(() => {
    if (!todo) return;
    let activo = true;
    const fin = () => setTodo(false);
    window.addEventListener('afterprint', fin);
    const imgs = [...(todoRef.current?.querySelectorAll('img') ?? [])];
    const cargada = (i: HTMLImageElement) =>
      new Promise<void>((listo) => {
        if (i.complete) return listo();
        i.addEventListener('load', () => listo(), { once: true });
        i.addEventListener('error', () => listo(), { once: true });
      });
    void Promise.all(imgs.map(cargada)).then(() => activo && window.print());
    return () => {
      activo = false;
      window.removeEventListener('afterprint', fin);
    };
  }, [todo]);

  const href = (id: string, seccion = '') => `/app/documentacion?cap=${id}${seccion ? `#${seccion}` : ''}`;
  const irA = (id: string) => setParams({ cap: id });

  return (
    <>
      <ViewHead
        title="Documentación"
        desc="Manual de usuario de SIVEN: qué hace cada parte del sistema y cómo usarla, paso a paso y con imágenes."
        actions={
          <>
            <button type="button" className="b b-out" onClick={() => window.print()} disabled={todo}>
              <Icon name="printer" size={16} /> Imprimir capítulo
            </button>
            <button type="button" className="b b-out" onClick={() => setTodo(true)} disabled={todo} aria-busy={todo}>
              <Icon name="book-open" size={16} /> {todo ? 'Preparando el manual…' : 'Imprimir todo el manual'}
            </button>
          </>
        }
      />
      <div className={`docs ${todo ? 'is-print-all' : ''}`}>
        <aside className="docs-nav" aria-label="Índice del manual">
          <label className="docs-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Buscar en el manual</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el manual…" />
          </label>
          {q.trim().length > 1 ? (
            <div className="docs-results" aria-live="polite">
              <p className="docs-results-n">
                {resultados.length ? `${resultados.length}${resultados.length === 40 ? '+' : ''} resultado(s)` : 'Sin resultados. Pruebe con otra palabra.'}
              </p>
              {resultados.map((r) => (
                <Link key={`${r.cap.id}#${r.seccion.id}`} to={href(r.cap.id, r.seccion.id)} className="docs-hit">
                  <b>{r.seccion.id ? r.seccion.titulo : r.cap.titulo}</b>
                  {r.seccion.id && <small>{r.cap.titulo}</small>}
                  <span>{r.fragmento}</span>
                </Link>
              ))}
            </div>
          ) : (
            // En celular el índice empieza cerrado y se cierra al elegir un capítulo.
            <details className="docs-toc" open={!mobile} key={mobile ? 'm' : 'd'} ref={toc}>
              <summary>Índice del manual</summary>
              {GRUPOS.map((g) => (
                <div key={g} className="docs-group">
                  <h3>{g}</h3>
                  <ul>
                    {CAPITULOS.filter((c) => c.grupo === g).map((c) => {
                      const bloqueado = !!c.modulo && !permitidos.has(c.modulo);
                      return (
                        <li key={c.id}>
                          <Link
                            to={href(c.id)}
                            onClick={() => mobile && toc.current && (toc.current.open = false)}
                            className={c.id === cap.id ? 'is-on' : ''}
                            aria-current={c.id === cap.id ? 'page' : undefined}
                            title={bloqueado ? 'Su rol no abre este módulo; puede leer cómo funciona.' : undefined}
                          >
                            <span>{c.titulo}</span>
                            {bloqueado && <Icon name="lock" size={13} label="Módulo que su rol no abre" />}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </details>
          )}
        </aside>

        <article className="docs-body" aria-labelledby="docs-title">
          <p className="docs-kicker">
            {cap.grupo} · capítulo {idx + 1} de {CAPITULOS.length}
          </p>
          <h1 id="docs-title">{cap.titulo}</h1>
          {cap.resumen && (
            <p className="docs-lead">
              <Inline text={cap.resumen} />
            </p>
          )}
          {roles.length > 0 && (
            <div className="docs-roles">
              <span>Lo usan:</span>
              {roles.map((r) => (
                <span key={r} className={`docs-role ${user?.role === r ? 'is-me' : ''}`}>
                  {ROLES[r].name}
                </span>
              ))}
            </div>
          )}
          {sinAcceso && (
            <div className="md-note is-nota" role="note">
              <Icon name="lock" size={18} />
              <div>Su rol no abre este módulo. Puede leer cómo funciona; si lo necesita para su trabajo, pídale acceso al administrador del sistema.</div>
            </div>
          )}
          {subtitulos.length > 2 && (
            <nav className="docs-onthis" aria-label="En este capítulo">
              <b>En este capítulo</b>
              <ol>
                {subtitulos.map((s) => (
                  <li key={s.id}>
                    <Link to={href(cap.id, s.id)}>{s.text.replace(/[*`]/g, '')}</Link>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="md">
            <Markdown blocks={cap.blocks} onZoom={setZoom} />
          </div>

          <nav className="docs-pager" aria-label="Otros capítulos">
            {anterior ? (
              <button type="button" className="docs-pager-btn" onClick={() => irA(anterior.id)}>
                <Icon name="chevron-left" size={18} />
                <span>
                  <small>Anterior</small>
                  {anterior.titulo}
                </span>
              </button>
            ) : (
              <span />
            )}
            {siguiente && (
              <button type="button" className="docs-pager-btn is-next" onClick={() => irA(siguiente.id)}>
                <span>
                  <small>Siguiente</small>
                  {siguiente.titulo}
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            )}
          </nav>
        </article>
      </div>

      {todo && (
        <div className="docs-all" ref={todoRef}>
          <section className="docs-all-cover">
            <p className="docs-kicker">NORCOR Fueling System</p>
            <h1>Manual de usuario de SIVEN</h1>
            <p className="docs-lead">Sistema de Inventario y Ventas: qué hace cada parte del sistema y cómo usarla, paso a paso y con imágenes.</p>
            <h2>Contenido</h2>
            <div className="docs-all-tocs">
              {GRUPOS.map((g) => (
                <div key={g} className="docs-all-toc">
                  <h3>{g}</h3>
                  <ol>
                    {CAPITULOS.filter((c) => c.grupo === g).map((c) => (
                      <li key={c.id} value={CAPITULOS.indexOf(c) + 1}>
                        {c.titulo}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
          {CAPITULOS.map((c, i) => (
            <article key={c.id} className="docs-all-cap">
              <p className="docs-kicker">
                {c.grupo} · capítulo {i + 1} de {CAPITULOS.length}
              </p>
              <h1>{c.titulo}</h1>
              {c.resumen && (
                <p className="docs-lead">
                  <Inline text={c.resumen} />
                </p>
              )}
              <div className="md">
                <Markdown blocks={c.blocks} eager />
              </div>
            </article>
          ))}
        </div>
      )}

      {zoom && (
        <div className="docs-zoom" role="dialog" aria-modal="true" aria-label={zoom.alt || 'Imagen ampliada'} onClick={() => setZoom(null)}>
          <button type="button" className="docs-zoom-x" aria-label="Cerrar la imagen" onClick={() => setZoom(null)}>
            <Icon name="x" size={22} />
          </button>
          <img src={zoom.src} alt={zoom.alt} />
          {zoom.alt && <p>{zoom.alt}</p>}
        </div>
      )}
    </>
  );
}
