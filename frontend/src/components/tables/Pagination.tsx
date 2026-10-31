/* Paginación de tablas largas (mejora n.° 20). */
import { PAGE_SIZES, type PagerState } from '../../hooks/usePaged';

/** Números a mostrar: primera, última y vecinas de la actual, con "…" en los saltos. */
function pageList(page: number, pages: number): Array<number | '…'> {
  const out: Array<number | '…'> = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

export function Pagination({ p, label = 'registros' }: { p: PagerState; label?: string }) {
  if (p.total <= PAGE_SIZES[0]) return null;
  const to = Math.min(p.start + p.size, p.total);
  return (
    <nav className="pager" aria-label="Paginación">
      <span className="pager-info">
        {p.start + 1}–{to} de {p.total} {label}
      </span>
      <div className="pager-pages">
        <button type="button" className="pager-btn" onClick={() => p.setPage(p.page - 1)} disabled={p.page === 1} aria-label="Página anterior">
          ‹
        </button>
        {pageList(p.page, p.pages).map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pager-btn ${n === p.page ? 'on' : ''}`}
              onClick={() => p.setPage(n)}
              aria-current={n === p.page ? 'page' : undefined}
              aria-label={`Página ${n}`}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="pager-btn" onClick={() => p.setPage(p.page + 1)} disabled={p.page === p.pages} aria-label="Página siguiente">
          ›
        </button>
      </div>
      <label className="pager-size">
        <select value={p.size} onChange={(e) => p.setSize(Number(e.target.value))} aria-label="Filas por página">
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>{' '}
        por página
      </label>
    </nav>
  );
}
