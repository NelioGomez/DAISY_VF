/* Layout del panel interno: sidebar por rol + topbar + área de vista. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { Logo } from '../components/common/Logo';
import { ACCESS, MENU, TITLES, isModuleId } from '../config/navigation';
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
  const { db } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch('/app/:module');
  const clock = useClock();
  const [menuOpen, setMenuOpen] = useState(false);

  // Igual que go() del prototipo: al cambiar de vista se sube al inicio de la página.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!user) return null;

  const allowed = ACCESS[user.role];
  const param = match?.params.module;
  const moduleId: ModuleId = isModuleId(param) ? param : 'dashboard';
  const [title, crumb] = TITLES[moduleId];

  const badges: Partial<Record<ModuleId, number>> = {
    inventario: db.productos.filter((p) => p.stock <= p.stockMin).length,
    productos: db.productos.filter((p) => p.stock <= p.stockMin).length,
    consultas: db.consultas.filter((c) => c.estado === 'Nueva').length,
    pagos: db.ventas.filter((v) => v.saldo > 0).length,
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
          <div className="clock">{clock}</div>
          <button className="icon-btn" title="Catálogo público" aria-label="Catálogo público" onClick={() => navigate('/catalogo')}>
            🌐
          </button>
          <div className="userchip">
            <div className="av" style={{ background: `linear-gradient(160deg,${user.color},#1a2c3d)` }}>
              {user.name[0]}
            </div>
            <div>
              <b>{user.name}</b>
              <span>@{user.user}</span>
            </div>
          </div>
          <button className="icon-btn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={handleLogout}>
            ⎋
          </button>
        </header>
        <main className="view">
          <Outlet />
        </main>
      </div>
    </section>
  );
}
