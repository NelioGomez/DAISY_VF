import { useEffect, useState } from 'react';

/** El valor, pero solo después de `ms` sin cambios (búsquedas que consultan al servidor). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
