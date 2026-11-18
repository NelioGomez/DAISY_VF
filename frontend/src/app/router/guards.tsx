import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AccessDenied } from '../../components/common/AccessDenied';
import { ACCESS } from '../../config/navigation';
import { useAuth } from '../../store/hooks';
import type { ModuleId } from '../../types';

/** Exige sesión iniciada; si no, redirige al login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
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
