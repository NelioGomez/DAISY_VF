/* Layout del panel interno: sidebar por rol + topbar + área de vista. */
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { MENU, MODULE_DATA, TITLES, isModuleId, visibleModules } from '../config/navigation';
import { LoadErrors } from '../components/feedback/LoadErrors';
import { SkeletonPage } from '../components/feedback/Skeleton';
import { RealtimeIndicator } from '../components/feedback/RealtimeIndicator';
import { SESSION_IDLE_MINUTES } from '../config/security';
import { readNoticesEnabled, storeNoticesEnabled, useRealtimeNotices } from '../features/realtime/useRealtimeNotices';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { recordStore } from '../components/modals/recordStore';
import { useModal } from '../components/modals/useModal';
import { NotificationBell } from '../features/dashboard/NotificationBell';
import { GlobalSearch } from '../features/search/GlobalSearch';
import { QuotationFormModal } from '../features/quotations/QuotationFormModal';
import { withRecordParam } from '../features/records/records';
import { useRecordUrlSync } from '../features/records/useRecordUrlSync';
import { useAuth, useData } from '../store/hooks';
import type { ModuleId } from '../types';

/** Pantallas dentro de un módulo (título propio y breadcrumb). */
const SUBPAGES: Record<string, string> = {
  '/app/ventas/nueva': 'Punto de venta',
};

function useClock(): string {
  const fmt = () => new Date().toLocaleString('es-NI', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setNow(fmt()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function DashboardLayout() {
  const { user, logout, can } = useAuth();
  const modal = useModal();
  const { db, status, loadError, reload, realtime } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch('/app/:module/*');
  const clock = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notices, setNotices] = useState(readNoticesEnabled);
  useRealtimeNotices(notices);
  // Registro abierto en el panel lateral: dirección propia y último tramo de la ruta (n.° 32 y 33).
  useRecordUrlSync();
  const record = useSyncExternalStore(recordStore.subscribe, recordStore.get);
  // Título de la pestaña: el registro abierto o la pantalla (sirve también en el historial).
  const modParam = match?.params.module;
  const tabTitle = record.label ?? SUBPAGES[location.pathname] ?? TITLES[isModuleId(modParam) ? modParam : 'dashboard'][0];
  useEffect(() => {
    const prev = document.title;
    document.title = `${tabTitle} · SIVEN NORCOR`;
    return () => {
      document.title = prev;
    };
  }, [tabTitle]);

  // Igual que go() del prototipo: al cambiar de vista se sube al inicio de la página.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Cierre automático por inactividad; al volver a entrar se regresa a la misma vista.
  // (RequireAuth redirige al login guardando la ruta; el login lee el motivo de la sesión.)
  useIdleTimeout(SESSION_IDLE_MINUTES, () => logout('idle'), !!user);

  // Atajos de teclado (mejora n.° 31): Alt + V nueva venta, Alt + C nueva cotización.
  // Se usa e.code (tecla física) para que funcione con teclado en español.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl + K (o ⌘ + K): búsqueda global (mejora n.° 7).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyK') {
        e.preventDefault();
        modal.open(<GlobalSearch />);
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'KeyV' && can('sales:write') && can('customers:read')) {
        e.preventDefault();
        navigate('/app/ventas/nueva');
      } else if (e.code === 'KeyC' && can('quotations:write') && can('customers:read')) {
        e.preventDefault();
        navigate('/app/cotizaciones');
        modal.open(<QuotationFormModal />);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [can, modal, navigate]);

  if (!user) return null;

  const allowed = visibleModules(user);
  const param = match?.params.module;
  const moduleId: ModuleId = isModuleId(param) ? param : 'dashboard';
  const [title, desc] = TITLES[moduleId];
  // Ruta de navegación (mejora n.° 32): Inicio › Módulo › Subpantalla › Registro abierto,
  // p. ej. Inicio › Ventas y Facturación › Factura FAC-000125. Cada tramo anterior es un enlace.
  const sub = SUBPAGES[location.pathname];
  const home = allowed.includes('dashboard') ? '/app/dashboard' : `/app/${allowed[0] ?? 'dashboard'}`;
  const here = location.pathname + withRecordParam(location.search, null);
  const crumbs: Array<{ label: string; to: string }> = [{ label: 'Inicio', to: home }];
  if (moduleId !== 'dashboard') crumbs.push({ label: title, to: `/app/${moduleId}` });
  if (sub) crumbs.push({ label: sub, to: here });
  if (record.key) crumbs.push({ label: record.label ?? 'Detalle', to: '' });

  const badges: Partial<Record<ModuleId, number>> = {
    inventario: db.productos.filter((p) => p.stock <= p.stockMin).length,
    productos: db.productos.filter((p) => p.stock <= p.stockMin).length,
    consultas: db.consultas.filter((c) => c.estado === 'Nueva').length,
    compras: db.comprasResumen?.pendientes ?? 0,
    pagos: db.cxc.length,
    cotizaciones: db.cotizaciones.filter((c) => c.estado === 'Pendiente').length,
  };

  const handleLogout = () => {
    logout('manual');
    navigate('/login', { replace: true });
  };

  return (
    <section id="app">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <Logo variant="sidebar" />
        </div>
        <nav className="nav">
          {MENU.map((group) => {
            const items = group.items.filter((it) => allowed.includes(it.id) && (!it.perm || can(it.perm)));
            if (!items.length) return null;
            return (
              <div key={group.grp}>
                <div className="nav-group">{group.grp}</div>
                {items.map((it) => (
                  <NavLink
                    key={it.to ?? it.id}
                    to={it.to ?? `/app/${it.id}`}
                    end={it.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    <span className="ic">{it.ic}</span>
                    {it.t}
                    {!it.to && !!badges[it.id] && <span className="badge">{badges[it.id]}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="foot">
          @{user.user} · {user.name}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-label="Abrir menú">
            ☰
          </button>
          <div className="tb-title">
            <h1 title={desc}>{sub ?? title}</h1>
            <nav className="crumb" aria-label="Ruta de navegación">
              <ol>
                {crumbs.map((c, i) =>
                  i === crumbs.length - 1 ? (
                    <li key={c.label + i} aria-current="page" title={c.label}>
                      {c.label}
                    </li>
                  ) : (
                    <li key={c.label + i}>
                      <Link to={c.to}>{c.label}</Link>
                    </li>
                  ),
                )}
              </ol>
            </nav>
          </div>
          <div className="spacer" />
          <RealtimeIndicator
            status={realtime}
            notices={notices}
            onToggleNotices={() =>
              setNotices((on) => {
                storeNoticesEnabled(!on);
                return !on;
              })
            }
          />
          <button className="search-chip" onClick={() => modal.open(<GlobalSearch />)} aria-label="Buscar en todo el sistema (Ctrl + K)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Buscar…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NotificationBell />
          <div className="clock">{clock}</div>
          <button className="icon-btn tb-site" title="Catálogo público" aria-label="Catálogo público" onClick={() => navigate('/catalogo')}>
            🌐
          </button>
          <div className="userchip">
            <div className="av" style={{ background: `linear-gradient(160deg,${user.color},#1a2c3d)` }}>
              {user.name[0]}
            </div>
            <div>
              <b>{user.fullName}</b>
              <span>{user.name}</span>
            </div>
          </div>
          <button className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}>
            ⎋
          </button>
        </header>
        <main className="view">
          {status === 'loading' || status === 'idle' ? (
            <SkeletonPage />
          ) : status === 'error' ? (
            <div className="card conn-error" role="alert">
              <div style={{ fontSize: 36 }}>⚠️</div>
              <h2>No se pudieron cargar los datos</h2>
              <p>{loadError}</p>
              <button className="b b-amber" onClick={() => void reload()}>
                Reintentar
              </button>
            </div>
          ) : (
            // Cada módulo se descarga al abrirlo por primera vez (división del código).
            <Suspense fallback={<SkeletonPage />}>
              <LoadErrors keys={MODULE_DATA[moduleId]} />
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>
    </section>
  );
}
