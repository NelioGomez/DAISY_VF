import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AccessDenied } from '../../components/common/AccessDenied';
import { ACCESS } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import type { ModuleId } from '../../types';

/** Estado que viaja hacia /login: a dónde volver después de iniciar sesión. */
export interface LoginRedirectState {
  from?: string;
}

/** Exige sesión iniciada; si no, redirige al login recordando la ruta solicitada. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const state: LoginRedirectState = { from: location.pathname };
    return <Navigate to="/login" replace state={state} />;
  }
  return <>{children}</>;
}

/** Muestra "Acceso denegado" si el rol no tiene el módulo (control visual; el backend valida de verdad). */
export function RequireModule({ id, children }: { id: ModuleId; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!ACCESS[user.role].includes(id)) return <AccessDenied roleName={user.name} />;
  return <>{children}</>;
}

/** Redirige /app a la vista inicial del rol. */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/app/${ACCESS[user.role][0]}`} replace />;
}
