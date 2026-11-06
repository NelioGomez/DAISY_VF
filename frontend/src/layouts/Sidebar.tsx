/* Menú lateral por módulos desplegables (mejoras n.° 55 y 56).
   - Dashboard, Compras, Ventas y Producción se despliegan y muestran sus pantallas, como en los
     ERP comerciales. Se abre un módulo a la vez y el que contiene la pantalla actual se abre solo.
   - Un módulo cerrado muestra la suma de los avisos de sus pantallas.
   - En escritorio se puede contraer a una barra de íconos que se despliega al pasar el mouse
     (o al llegar con Tab); la preferencia queda guardada en el navegador.
   - En celular es un panel deslizable sobre la página: se cierra con ×, con Esc, tocando el
     fondo o al elegir una pantalla. Mientras está cerrado no recibe el foco. */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { isSection, MENU, type MenuBadge, type MenuEntry, type MenuItem, type MenuSection } from '../config/navigation';
import type { ModuleId } from '../types';

export interface BadgeInfo {
  n: number;
  /** Qué cuenta el aviso (para lectores de pantalla y la descripción emergente). */
  label: string;
}

interface Props {
  id: string;
  allowed: ModuleId[];
  can: (perm: string) => boolean;
  badges: Record<MenuBadge, BadgeInfo>;
  home: string;
  footer: string;
  /** Pantalla de celular: el menú es un panel deslizable. */
  mobile: boolean;
  /** Panel abierto (solo en celular). */
  open: boolean;
  /** Cierra el panel; con restoreFocus el foco vuelve al botón ☰. */
  onClose: (restoreFocus: boolean) => void;
  /** Barra de íconos (solo en escritorio). */
  rail: boolean;
  onToggleRail: () => void;
}

const itemPath = (it: MenuItem) => it.to ?? `/app/${it.id}`;
const itemHref = (it: MenuItem) => (it.tab && !it.tabDefault ? `${itemPath(it)}?tab=${it.tab}` : itemPath(it));

/** Pestañas que el menú conoce por módulo: una pestaña desconocida cuenta como la de inicio. */
const TABS_BY_MODULE = MENU.flatMap((e) => (isSection(e) ? e.items : [e])).reduce<Partial<Record<ModuleId, string[]>>>((acc, it) => {
  if (it.tab) (acc[it.id] ??= []).push(it.tab);
  return acc;
}, {});

function isActive(it: MenuItem, pathname: string, search: string): boolean {
  const path = itemPath(it);
  if (!(pathname === path || (!it.end && pathname.startsWith(`${path}/`)))) return false;
  if (!it.tab) return true;
  const raw = new URLSearchParams(search).get('tab');
  const tab = raw && TABS_BY_MODULE[it.id]?.includes(raw) ? raw : null;
  return tab ? tab === it.tab : !!it.tabDefault;
}

function Badge({ info }: { info: BadgeInfo }) {
  if (!info.n) return null;
  return (
    <span className="badge" title={`${info.n} ${info.label}`}>
      <span aria-hidden="true">{info.n}</span>
      <span className="sr-only">{`, ${info.n} ${info.label}`}</span>
    </span>
  );
}

export function Sidebar({ id, allowed, can, badges, home, footer, mobile, open, onClose, rail, onToggleRail }: Props) {
  const { pathname, search } = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Módulos y pantallas que el rol puede ver; un módulo con una sola pantalla visible pasa a ser
  // un enlace directo.
  const visible = (it: MenuItem) => allowed.includes(it.id) && (!it.perm || can(it.perm));
  const entries = MENU.flatMap<MenuEntry>((e) => {
    if (!isSection(e)) return visible(e) ? [e] : [];
    const items = e.items.filter(visible);
    if (items.length === 1) return [{ ...items[0], t: items[0].solo ?? items[0].t }];
    return items.length ? [{ ...e, items }] : [];
  });
  const activeKey = entries.find((e): e is MenuSection => isSection(e) && e.items.some((it) => isActive(it, pathname, search)))?.key ?? null;

  // Un módulo abierto a la vez; al llegar a otra pantalla se abre el módulo que la contiene.
  const [openKey, setOpenKey] = useState<string | null>(activeKey);
  const [seenKey, setSeenKey] = useState(activeKey);
  if (seenKey !== activeKey) {
    setSeenKey(activeKey);
    if (activeKey) setOpenKey(activeKey);
  }

  // Panel de celular: foco en ×, Esc para cerrar y la página de fondo sin desplazarse.
  const drawer = mobile && open;
  useEffect(() => {
    if (!drawer) return;
    closeRef.current?.focus();
    document.body.classList.add('nav-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('nav-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [drawer, onClose]);

  const pick = (e: MouseEvent<HTMLAnchorElement>) => {
    // En la barra de íconos, el clic con mouse suelta el foco para que la barra vuelva a cerrarse.
    if (rail && e.detail > 0) e.currentTarget.blur();
    if (mobile) onClose(false);
  };

  const link = (it: MenuItem, sub = false) => {
    const active = isActive(it, pathname, search);
    return (
      <Link
        key={`${it.id}:${it.to ?? ''}:${it.tab ?? ''}`}
        to={itemHref(it)}
        className={`${active ? 'active' : ''} ${sub ? 'is-sub' : ''}`.trim() || undefined}
        aria-current={active ? 'page' : undefined}
        onClick={pick}
      >
        <span className="ic" aria-hidden="true">
          {it.ic}
        </span>
        <span className="lbl">{it.t}</span>
        {it.badge && <Badge info={badges[it.badge]} />}
      </Link>
    );
  };

  return (
    <>
      <aside id={id} className={`sidebar ${open ? 'open' : ''}`} inert={mobile && !open}>
        <div className="brand">
          <Link to={home} className="brand-link" aria-label="NORCOR · ir al inicio" onClick={pick}>
            <Logo variant="sidebar" />
          </Link>
          <button ref={closeRef} type="button" className="nav-close" onClick={() => onClose(true)} aria-label="Cerrar menú">
            ✕
          </button>
        </div>
        <nav className="nav" aria-label="Menú principal">
          {entries.map((e) => {
            if (!isSection(e)) return link(e);
            const isOpen = openKey === e.key;
            const hasActive = activeKey === e.key;
            const avisos = e.items.reduce((n, it) => n + (it.badge ? badges[it.badge].n : 0), 0);
            const detalle = e.items
              .filter((it) => it.badge && badges[it.badge].n)
              .map((it) => `${badges[it.badge!].n} ${badges[it.badge!].label}`)
              .join(', ');
            return (
              <div key={e.key} className={`nav-sec-wrap ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className={`nav-sec ${hasActive ? 'has-active' : ''}`}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-${e.key}`}
                  onClick={() => setOpenKey((k) => (k === e.key ? null : e.key))}
                >
                  <span className="ic" aria-hidden="true">
                    {e.ic}
                  </span>
                  <span className="lbl">{e.t}</span>
                  {!!avisos && <Badge info={{ n: avisos, label: avisos === 1 ? `aviso (${detalle})` : `avisos (${detalle})` }} />}
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </button>
                <div id={`${id}-${e.key}`} className="nav-sub" inert={!isOpen}>
                  <div>{e.items.map((it) => link(it, true))}</div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="foot">
          <span className="foot-user">{footer}</span>
          <button
            type="button"
            className="nav-rail-btn"
            onClick={(e) => {
              onToggleRail();
              // Con mouse se suelta el foco para que la barra contraída se cierre al salir de ella.
              if (e.detail > 0) e.currentTarget.blur();
            }}
            aria-pressed={rail}
            title={rail ? 'Mantener el menú abierto' : 'Contraer el menú a íconos'}
          >
            <span className="ic" aria-hidden="true">
              {rail ? '»' : '«'}
            </span>
            <span className="lbl">{rail ? 'Fijar menú' : 'Contraer menú'}</span>
          </button>
        </div>
      </aside>
      {drawer && <div className="nav-backdrop" onClick={() => onClose(true)} aria-hidden="true" />}
    </>
  );
}
