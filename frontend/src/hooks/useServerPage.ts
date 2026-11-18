/* Lista paginada y filtrada por el servidor (mejora n.° 20): pide solo la página visible a la
   API (page, limit y filtros) y se actualiza sola con los avisos en tiempo real. */
import { useEffect, useState } from 'react';
import { errorMessage, request, type Pagination } from '../services/api/client';
import { subscribeRealtime } from '../services/realtime/realtime';
import { PAGE_SIZES, type PagerState } from './usePaged';

type Query = Record<string, string | number | boolean | undefined>;

function readSize(id: string): number {
  try {
    const v = Number(localStorage.getItem(`siven.pageSize.${id}`));
    return (PAGE_SIZES as readonly number[]).includes(v) ? v : 25;
  } catch {
    return 25;
  }
}

/**
 * `query` cambia cuando cambian los filtros (la página vuelve a 1). `map` y `modules` deben ser
 * estables (funciones o constantes de módulo).
 */
export function useServerPage<T>(path: string, query: Query, map: (row: unknown) => T, modules: readonly string[], id: string) {
  const queryKey = JSON.stringify(query);
  const [nav, setNav] = useState(() => ({ key: queryKey, page: 1, size: readSize(id) }));
  const page = nav.key === queryKey ? nav.page : 1;
  const size = nav.size;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ req: string; rows?: T[]; pagination?: Pagination; error?: string } | null>(null);
  const req = JSON.stringify([path, queryKey, page, size]);

  useEffect(() => {
    let alive = true;
    const q = JSON.parse(queryKey) as Query;
    request<unknown[]>('GET', path, { query: { ...q, page, limit: size } }).then(
      (r) => alive && setState({ req, rows: (r.data ?? []).map(map), pagination: r.pagination }),
      (e) => alive && setState((prev) => ({ ...(prev ?? {}), req, error: errorMessage(e) })),
    );
    return () => {
      alive = false;
    };
  }, [path, queryKey, page, size, map, req, version]);

  useEffect(
    () =>
      subscribeRealtime((e) => {
        if (modules.includes(e.module)) setVersion((v) => v + 1);
      }),
    [modules],
  );

  // Mientras llega la página nueva se siguen mostrando las filas anteriores (sin saltos).
  const total = state?.pagination?.total ?? state?.rows?.length ?? 0;
  const pages = Math.max(1, state?.pagination?.totalPages ?? 1);
  const pager: PagerState = {
    page,
    pages,
    size,
    total,
    start: (page - 1) * size,
    setPage: (p) => setNav({ key: queryKey, page: Math.max(1, Math.min(p, pages)), size }),
    setSize: (n) => {
      try {
        localStorage.setItem(`siven.pageSize.${id}`, String(n));
      } catch {
        /* sin almacenamiento: solo dura esta visita */
      }
      setNav({ key: queryKey, page: 1, size: n });
    },
  };
  return {
    rows: state?.rows ?? null,
    loading: !state || state.req !== req,
    error: state?.req === req ? (state.error ?? '') : '',
    reload: () => setVersion((v) => v + 1),
    pager,
  };
}
