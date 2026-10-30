import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { CustomerRedirectState } from './customerContext';
import { useCustomer } from './useCustomer';

/** Exige sesión de cliente; si no hay, lleva a "Iniciar sesión" y luego regresa. */
export function RequireCustomer({ children }: { children: ReactNode }) {
  const { cuenta, restaurando, salida } = useCustomer();
  const location = useLocation();
  if (restaurando)
    return (
      <div className="pub-page" aria-busy="true">
        <p className="pub-muted">Abriendo su cuenta…</p>
      </div>
    );
  if (!cuenta) {
    // Si la sesión venció, el inicio de sesión lo avisa y luego regresa a esta página.
    const state: CustomerRedirectState = { from: location.pathname + location.search, vencida: salida === 'expired' };
    return <Navigate to="/clientes/ingresar" replace state={state} />;
  }
  return <>{children}</>;
}
