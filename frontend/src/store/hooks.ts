import { useContext } from 'react';
import { StoreContext, type StoreValue } from './storeContext';

function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}

/** Sesión del usuario (JWT emitido por NestJS) y sus permisos. */
export function useAuth() {
  const { user, login, logout, lastLogout, booting, can } = useStore();
  return { user, login, logout, lastLogout, booting, can };
}

/** Datos cargados desde la API y operaciones de negocio. */
export function useData() {
  const { db, actions, status, loadError, failed, reload, realtime } = useStore();
  return { db, ...actions, status, loadError, failed, reload, realtime };
}
