/* Layout del panel interno: menú por módulos según el rol + topbar + área de vista.
   En celular el menú es un panel deslizable (mejora n.° 56); en escritorio se puede contraer. */
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { MODULE_DATA, TITLES, isModuleId, visibleModules, type MenuBadge } from '../config/navigation';
import { Icon } from '../components/common/Icon';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { LoadErrors } from '../components/feedback/LoadErrors';
import { SkeletonPage } from '../components/feedback/Skeleton';
import { RealtimeIndicator } from '../components/feedback/RealtimeIndicator';
import { SESSION_IDLE_MINUTES } from '../config/security';
import { readNoticesEnabled, storeNoticesEnabled, useRealtimeNotices } from '../features/realtime/useRealtimeNotices';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useWideTables } from '../hooks/useWideTables';
import { recordStore } from '../components/modals/recordStore';
import { useModal } from '../components/modals/useModal';
import { NotificationBell } from '../features/dashboard/NotificationBell';
import { GlobalSearch } from '../features/search/GlobalSearch';
import { QuotationFormModal } from '../features/quotations/QuotationFormModal';
import { withRecordParam } from '../features/records/records';
import { useRecordUrlSync } from '../features/records/useRecordUrlSync';
import { useAuth, useData } from '../store/hooks';
import type { ModuleId } from '../types';
import { Sidebar, type BadgeInfo } from './Sidebar';

/** Pantallas dentro de un módulo (título propio y breadcrumb). */
const SUBPAGES: Record<string, string> = {
  '/app/ventas/nueva': 'Punto de venta',
};

/** Preferencia del menú contraído a íconos (escritorio). */
const RAIL_KEY = 'siven.menu.compacto';

function readRail(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

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
  // Panel del menú en celular: se cierra solo al cambiar de pantalla.
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [menu, setMenu] = useState({ open: false, at: '' });
  const urlActual = location.pathname + location.search;
  const menuOpen = mobile && menu.open && menu.at === urlActual;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenu({ open: false, at: '' });
    // Después de que la página deja de estar inactiva (inert) el foco vuelve al botón ☰.
    if (restoreFocus) setTimeout(() => toggleRef.current?.focus(), 0);
  }, []);
  const [rail, setRail] = useState(readRail);
  const toggleRail = () =>
    setRail((r) => {
      try {
        localStorage.setItem(RAIL_KEY, r ? '0' : '1');
      } catch {
        /* sin almacenamiento: solo dura esta visita */
      }
      return !r;
    });
  const [notices, setNotices] = useState(readNoticesEnabled);
  useRealtimeNotices(notices);
  // Tablas anchas: desplazamiento horizontal en vez de columnas recortadas.
  useWideTables();
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

  const aviso = (n: number, uno: string, varios: string): BadgeInfo => ({ n, label: n === 1 ? uno : varios });
  const badges: Record<MenuBadge, BadgeInfo> = {
    criticos: aviso(db.productos.filter((p) => p.stock <= p.stockMin).length, 'producto en o bajo el mínimo', 'productos en o bajo el mínimo'),
    comprasPorRecibir: aviso(db.comprasResumen?.pendientes ?? 0, 'compra por recibir', 'compras por recibir'),
    cotizacionesPendientes: aviso(db.cotizaciones.filter((c) => c.estado === 'Pendiente').length, 'cotización pendiente', 'cotizaciones pendientes'),
    cxc: aviso(db.cxc.length, 'cuenta por cobrar', 'cuentas por cobrar'),
    consultasNuevas: aviso(db.consultas.filter((c) => c.estado === 'Nueva').length, 'consulta web nueva', 'consultas web nuevas'),
  };

  const handleLogout = () => {
    logout('manual');
    navigate('/login', { replace: true });
  };

  return (
    <section id="app" className={rail ? 'is-rail' : undefined}>
      <Sidebar
        id="app-sidebar"
        allowed={allowed}
        can={can}
        badges={badges}
        home={home}
        footer={`@${user.user} · ${user.name}`}
        mobile={mobile}
        open={menuOpen}
        onClose={closeMenu}
        rail={rail}
        onToggleRail={toggleRail}
      />

      <div className="main" inert={menuOpen}>
        <header className="topbar">
          <button
            ref={toggleRef}
            className="icon-btn menu-toggle"
            onClick={() => setMenu({ open: true, at: urlActual })}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
          >
            <Icon name="menu" size={20} />
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
            <Icon name="search" size={15} />
            <span>Buscar…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NotificationBell />
          <div className="clock">{clock}</div>
          <ThemeToggle />
          {moduleId !== 'documentacion' && (
            <Link
              className="icon-btn tb-help"
              to={`/app/documentacion?cap=${location.pathname.startsWith('/app/ventas/nueva') ? 'pos' : moduleId}`}
              title="Manual de esta pantalla"
              aria-label="Manual de usuario de esta pantalla"
            >
              <Icon name="circle-help" />
            </Link>
          )}
          {user.permissions.includes('users:write') && (
            <Link className="icon-btn tb-admin" to="/admin" title="Panel de administración: usuarios, categorías, marcas y empresa" aria-label="Panel de administración">
              <Icon name="user-cog" />
            </Link>
          )}
          <a className="icon-btn tb-site" href="/catalogo" target="_blank" rel="noreferrer" title="Sitio público (se abre en otra pestaña)" aria-label="Sitio público, se abre en otra pestaña">
            <Icon name="globe" />
          </a>
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
            <Icon name="log-out" />
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
