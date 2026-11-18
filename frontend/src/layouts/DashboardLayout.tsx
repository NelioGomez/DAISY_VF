/* Layout del panel interno: sidebar por rol + topbar + área de vista. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { MENU, TITLES, isModuleId, visibleModules } from '../config/navigation';
import { ViewLoader } from '../components/feedback/FullScreenLoader';
import { RealtimeIndicator } from '../components/feedback/RealtimeIndicator';
import { SESSION_IDLE_MINUTES } from '../config/security';
import { readNoticesEnabled, storeNoticesEnabled, useRealtimeNotices } from '../features/realtime/useRealtimeNotices';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { useAuth, useData } from '../store/hooks';
import type { ModuleId } from '../types';

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
  const { user, logout } = useAuth();
  const { db, status, loadError, reload, realtime } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch('/app/:module');
  const clock = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notices, setNotices] = useState(readNoticesEnabled);
  useRealtimeNotices(notices);

  // Igual que go() del prototipo: al cambiar de vista se sube al inicio de la página.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Cierre automático por inactividad; al volver a entrar se regresa a la misma vista.
  // (RequireAuth redirige al login guardando la ruta; el login lee el motivo de la sesión.)
  useIdleTimeout(SESSION_IDLE_MINUTES, () => logout('idle'), !!user);

  if (!user) return null;

  const allowed = visibleModules(user);
  const param = match?.params.module;
  const moduleId: ModuleId = isModuleId(param) ? param : 'dashboard';
  const [title, crumb] = TITLES[moduleId];

  const badges: Partial<Record<ModuleId, number>> = {
    inventario: db.productos.filter((p) => p.stock <= p.stockMin).length,
    productos: db.productos.filter((p) => p.stock <= p.stockMin).length,
    consultas: db.consultas.filter((c) => c.estado === 'Nueva').length,
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
            const items = group.items.filter((it) => allowed.includes(it.id));
            if (!items.length) return null;
            return (
              <div key={group.grp}>
                <div className="nav-group">{group.grp}</div>
                {items.map((it) => (
                  <NavLink key={it.id} to={`/app/${it.id}`} onClick={() => setMenuOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
                    <span className="ic">{it.ic}</span>
                    {it.t}
                    {!!badges[it.id] && <span className="badge">{badges[it.id]}</span>}
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
          <div>
            <h1>{title}</h1>
            <div className="crumb">NORCOR · {crumb}</div>
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
          <div className="clock">{clock}</div>
          <button className="icon-btn" title="Catálogo público" aria-label="Catálogo público" onClick={() => navigate('/catalogo')}>
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
            <ViewLoader text="Cargando datos del servidor…" />
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
            <Outlet />
          )}
        </main>
      </div>
    </section>
  );
}
