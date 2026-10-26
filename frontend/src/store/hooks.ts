import { useContext } from 'react';
import { StoreContext, type StoreValue } from './storeContext';

function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}

/** Sesión del usuario (simulada; luego se reemplaza por JWT desde NestJS). */
export function useAuth() {
  const { user, login, logout, lastLogout } = useStore();
  return { user, login, logout, lastLogout };
}

/** Datos y operaciones de negocio. */
export function useData() {
  const { db, actions } = useStore();
  return { db, ...actions };
}
