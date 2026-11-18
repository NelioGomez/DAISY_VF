import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AccessDenied } from '../../components/common/AccessDenied';
import { FullScreenLoader } from '../../components/feedback/FullScreenLoader';
import { visibleModules } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import type { ModuleId } from '../../types';

/** Estado que viaja hacia /login. */
export interface LoginRedirectState {
  /** Ruta a la que volver después de iniciar sesión. */
  from?: string;
  /** Usuario que acaba de restablecer su contraseña (muestra aviso y lo precarga). */
  resetUsername?: string;
  /** La recuperación se hizo en modo simulación: la contraseña real no cambió. */
  resetSimulated?: boolean;
}

/** Exige sesión iniciada; si no, redirige al login recordando la ruta solicitada. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <FullScreenLoader text="Restaurando su sesión…" />;
  if (!user) {
    const state: LoginRedirectState = { from: location.pathname };
    return <Navigate to="/login" replace state={state} />;
  }
  return <>{children}</>;
}

/** Muestra "Acceso denegado" si el rol o los permisos no incluyen el módulo (el backend valida igual). */
export function RequireModule({ id, children }: { id: ModuleId; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!visibleModules(user).includes(id)) return <AccessDenied roleName={user.name} />;
  return <>{children}</>;
}

/** Redirige /app a la vista inicial del usuario. */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const first = visibleModules(user)[0];
  if (!first) return <AccessDenied roleName={user.name} />;
  return <Navigate to={`/app/${first}`} replace />;
}
