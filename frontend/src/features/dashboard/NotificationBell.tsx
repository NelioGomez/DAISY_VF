/* Campana de pendientes (mejora n.° 1): contador y lista de alertas que llevan a la
   pantalla donde se resuelven. Se actualiza sola con los eventos en tiempo real
   (el resumen del dashboard se vuelve a pedir cuando cambian ventas, compras, etc.). */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useData } from '../../store/hooks';
import { agenda } from './agenda';

export function NotificationBell() {
  const { db } = useData();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items = agenda(db.dashboard, can);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    box.current?.querySelector<HTMLElement>('.agenda-li')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!db.dashboard) return null;
  const tone = items.some((i) => i.severidad === 'critical') ? '' : items.some((i) => i.severidad === 'warning') ? 'warn' : 'info';

  return (
    <div className="bell" ref={box}>
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="bell-pop"
        aria-label={items.length ? `Pendientes: ${items.length}` : 'Sin pendientes'}
        title="Pendientes"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {items.length > 0 && <span className={`bell-count ${tone}`}>{items.length}</span>}
      </button>
      {open && (
        <div className="bell-pop" id="bell-pop" role="region" aria-label="Pendientes">
          <h4>Pendientes</h4>
          {items.length ? (
            items.map((i) => (
              <Link key={i.tipo} to={i.link} className="agenda-li" onClick={() => setOpen(false)}>
                <span className={`ic sev-${i.severidad}`} aria-hidden="true">
                  {i.ic}
                </span>
                <span className="txt">{i.mensaje}</span>
                <span className="cta">{i.accion}</span>
              </Link>
            ))
          ) : (
            <p className="bell-empty">Todo al día: no hay pendientes.</p>
          )}
        </div>
      )}
    </div>
  );
}
