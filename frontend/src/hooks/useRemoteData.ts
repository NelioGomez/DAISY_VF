/* Datos que una pantalla trae por su cuenta (no viven en el store global) y que se vuelven a
   pedir cuando el servidor avisa de un cambio en alguno de `modules` (tiempo real). */
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../services/api/client';
import { subscribeRealtime } from '../services/realtime/realtime';

/**
 * `load` debe ser estable (función de módulo o useCallback) y `modules` una constante.
 * Devuelve el último dato, el error (para mostrar "Reintentar"), `reload` y `set` (para usar
 * la respuesta de una acción sin volver a pedir).
 */
export function useRemoteData<T>(load: () => Promise<T>, modules: readonly string[]) {
  const [state, setState] = useState<{ load: () => Promise<T>; data?: T; error?: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    load().then(
      (data) => alive && setState({ load, data }),
      (e) => alive && setState((prev) => (prev && prev.load === load && prev.data !== undefined ? { ...prev, error: errorMessage(e) } : { load, error: errorMessage(e) })),
    );
    return () => {
      alive = false;
    };
  }, [load, version]);

  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (modules.includes(e.module)) setVersion((v) => v + 1);
      }),
    [modules],
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const set = useCallback((data: T) => setState({ load, data }), [load]);
  const current = state && state.load === load ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? '', loading: !current, reload, set };
}
