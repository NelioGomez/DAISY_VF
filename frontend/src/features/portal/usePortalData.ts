import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../services/api/client';
import { isSessionError } from '../../services/portal/portalService';
import { useCustomer } from './useCustomer';

/**
 * Si el token del cliente venció: cierra la sesión. La página protegida (RequireCustomer)
 * lleva entonces al inicio de sesión con el aviso de sesión vencida.
 */
export function useSessionExpired(): (e: unknown) => boolean {
  const { salir } = useCustomer();
  return useCallback(
    (e: unknown) => {
      if (!isSessionError(e)) return false;
      salir('expired');
      return true;
    },
    [salir],
  );
}

type State<T> = { key: string; data: T } | { key: string; error: string };

/**
 * Carga datos del portal con el token del cliente. `key` identifica la consulta:
 * cuando cambia, se vuelve a pedir. Devuelve null mientras carga.
 */
export function usePortalData<T>(key: string, load: (token: string) => Promise<T>) {
  const { token } = useCustomer();
  const expired = useSessionExpired();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State<T> | null>(null);
  const reqKey = `${key}#${attempt}`;

  useEffect(() => {
    if (!token) return;
    let alive = true;
    load(token)
      .then((data) => alive && setState({ key: reqKey, data }))
      .catch((e) => {
        if (!alive || expired(e)) return;
        setState({ key: reqKey, error: errorMessage(e) });
      });
    return () => {
      alive = false;
    };
    // `load` se recrea en cada render; la consulta la identifica `reqKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, token]);

  const current = state && state.key === reqKey ? state : null;
  return {
    data: current && 'data' in current ? current.data : null,
    error: current && 'error' in current ? current.error : null,
    loading: !current,
    reload: () => setAttempt((n) => n + 1),
  };
}
