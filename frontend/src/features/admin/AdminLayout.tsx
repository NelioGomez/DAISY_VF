/* PANEL DE ADMINISTRACIÓN (mejora n.° 66)
   Área aparte de SIVEN, como el sitio público y el portal: su propia barra y su propio menú, en
   /admin. Solo la abre quien puede administrar usuarios (el rol Administrador). Aquí se crean
   usuarios y se les asigna rol, se restablecen contraseñas, se mantienen las categorías y marcas,
   se activan o desactivan clientes y proveedores, y se configuran los datos de la empresa. */
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { LoginRedirectState } from '../../app/router/guards';
import { Icon, type IconName } from '../../components/common/Icon';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { FullScreenLoader } from '../../components/feedback/FullScreenLoader';
import { ROLES } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import './admin.css';

const SECCIONES: Array<{ to: string; label: string; ic: IconName }> = [
  { to: 'usuarios', label: 'Usuarios', ic: 'users' },
  { to: 'roles', label: 'Roles y permisos', ic: 'lock' },
  { to: 'catalogos', label: 'Categorías y marcas', ic: 'layers' },
  { to: 'socios', label: 'Clientes y proveedores', ic: 'truck' },
  { to: 'empresa', label: 'Empresa', ic: 'cog' },
];

/** Quién puede entrar al panel. */
export const puedeAdministrar = (permissions: string[]) => permissions.includes('users:write');

export function AdminLayout() {
  const { user, booting, logout } = useAuth();
  const location = useLocation();
  if (booting) return <FullScreenLoader text="Restaurando su sesión…" />;
  if (!user) {
    const state: LoginRedirectState = { from: location.pathname };
    return <Navigate to="/login" replace state={state} />;
  }

  if (!puedeAdministrar(user.permissions)) {
    return (
      <div className="adm adm-denied">
        <div className="adm-card">
          <Icon name="lock" size={34} />
          <h1>Panel de administración</h1>
          <p>Solo el administrador del sistema puede entrar aquí. Su rol es {ROLES[user.role].name}.</p>
          <Link className="b b-amber" to="/app">
            Volver a SIVEN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top-in">
          <Link className="adm-brand" to="/admin" aria-label="Panel de administración">
            <span className="adm-mark">N</span>
            <span>
              <b>NORCOR</b>
              <small>Administración</small>
            </span>
          </Link>
          <nav className="adm-nav" aria-label="Secciones de administración">
            {SECCIONES.map((s) => (
              <NavLink key={s.to} to={s.to} className={({ isActive }) => (isActive ? 'is-on' : '')}>
                <Icon name={s.ic} size={16} />
                <span>{s.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="adm-actions">
            <ThemeToggle className="adm-icon" />
            <Link className="adm-icon" to="/app" title="Ir a SIVEN" aria-label="Ir a SIVEN">
              <Icon name="layout-dashboard" size={18} />
            </Link>
            <span className="adm-user" title={user.email}>
              <b>{user.fullName || user.name}</b>
              <small>{ROLES[user.role].name}</small>
            </span>
            <button type="button" className="adm-icon" onClick={() => logout('manual')} title="Cerrar sesión" aria-label="Cerrar sesión">
              <Icon name="log-out" size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
