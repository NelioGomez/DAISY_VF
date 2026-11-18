import { useEffect, useState } from 'react';
import { infoPublica, type InfoPublica } from '../../services/public/publicService';

/** Empresa, categorías y marcas del sitio público (una sola petición por visita). */
export function usePublicInfo(): { info: InfoPublica | null; error: boolean } {
  const [state, setState] = useState<{ info: InfoPublica | null; error: boolean }>({ info: null, error: false });
  useEffect(() => {
    let alive = true;
    infoPublica()
      .then((info) => alive && setState({ info, error: false }))
      .catch(() => alive && setState({ info: null, error: true }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
