/* Indica si se cumple una consulta de medios (p. ej. pantalla de celular) y se actualiza al
   girar el equipo o cambiar el tamaño de la ventana. */
import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener('change', notify);
      return () => mq?.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => !!window.matchMedia?.(query).matches,
    () => false,
  );
}

/** Mismo corte que el CSS: hasta 880 px el menú es un panel deslizable. */
export const MOBILE_QUERY = '(max-width: 880px)';
