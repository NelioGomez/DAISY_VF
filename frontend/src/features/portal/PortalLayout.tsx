/* Portal del cliente (mejora n.° 43): Mis solicitudes, Mis cotizaciones, Mi perfil
   y Cerrar sesión. No expone módulos internos ni comparte su navegación. */
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/feedback/useToast';
import { useCustomer } from './useCustomer';

export function PortalLayout() {
  const { cuenta, salir } = useCustomer();
  const toast = useToast();
  const navigate = useNavigate();
  const saliendo = useRef(false);

  // La sesión se cierra cuando el portal ya se desmontó (ya en la portada); así la
  // protección de las páginas privadas no alcanza a mandar al inicio de sesión.
  useEffect(
    () => () => {
      if (saliendo.current) salir('manual');
    },
    [salir],
  );

  if (!cuenta) return null;

  const cerrar = () => {
    saliendo.current = true;
    toast('Sesión cerrada', 'info');
    navigate('/', { replace: true });
  };

  return (
    <div className="pub-portal">
      <header className="pub-portal-head">
        <h1>Hola, {cuenta.contacto.split(' ')[0] || cuenta.contacto}</h1>
        <p className="pub-muted">
          Cuenta de <strong>{cuenta.cliente.nombre}</strong>
        </p>
      </header>
      <div className="pub-portal-body">
        <nav className="pub-portal-nav" aria-label="Mi cuenta">
          <NavLink to="/clientes/cuenta/solicitudes">Mis solicitudes</NavLink>
          <NavLink to="/clientes/cuenta/cotizaciones">Mis cotizaciones</NavLink>
          <NavLink to="/clientes/cuenta/perfil">Mi perfil</NavLink>
          <button type="button" onClick={cerrar}>
            Cerrar sesión
          </button>
        </nav>
        <section className="pub-portal-main">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
