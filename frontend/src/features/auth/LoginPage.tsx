import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import { useToast } from '../../components/feedback/useToast';
import { ACCESS, MODULE_COUNT, ROLES, ROLE_KEYS } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import type { RoleKey } from '../../types';

export function LoginPage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [role, setRole] = useState<RoleKey>('admin');
  const [username, setUsername] = useState(ROLES.admin.user);
  const [password, setPassword] = useState('••••••••');

  if (user) return <Navigate to="/app" replace />;

  const selectRole = (r: RoleKey) => {
    setRole(r);
    setUsername(ROLES[r].user);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Autenticación simulada: la contraseña aún no se valida (se hará con /auth/login en NestJS).
    const u = login(role, username);
    toast('Sesión iniciada como ' + u.name, 'ok');
    navigate(`/app/${ACCESS[role][0]}`);
  };

  return (
    <section id="login">
      <div className="login-box">
        <div className="login-brand">
          <Logo />
          <h1>Sistema Web de Gestión de Ventas y Control de Inventario</h1>
          <p>Plataforma empresarial para administrar inventario, ventas, cotizaciones, facturación, pagos, reportes y catálogo web de repuestos para gasolineras.</p>
          <div className="login-meta">
            <div>
              <b>N-Capas</b>
              <span>Arquitectura</span>
            </div>
            <div>
              <b>NestJS · React</b>
              <span>Stack base</span>
            </div>
            <div>
              <b>{ROLE_KEYS.length} roles</b>
              <span>Acceso</span>
            </div>
            <div>
              <b>{MODULE_COUNT} módulos</b>
              <span>Operación</span>
            </div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <h2>Iniciar sesión</h2>
          <div className="sub">Seleccione un rol para acceder al panel correspondiente.</div>
          <div className="roles">
            {ROLE_KEYS.map((k) => (
              <button type="button" key={k} className={`role-btn ${role === k ? 'sel' : ''}`} onClick={() => selectRole(k)}>
                <b>{ROLES[k].name}</b>
                <span>{ROLES[k].desc}</span>
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="luser">Usuario</label>
            <input id="luser" value={username} placeholder="usuario" onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lpass">Contraseña</label>
            <input id="lpass" type="password" value={password} placeholder="contraseña" onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-amber">
            Ingresar al sistema
          </button>
          <button type="button" className="link" onClick={() => navigate('/catalogo')}>
            Ver catálogo web público →
          </button>
        </form>
      </div>
    </section>
  );
}
