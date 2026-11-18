/* Paginación en el cliente (mejora n.° 20): 25 / 50 / 100 filas por página. El tamaño elegido
   se recuerda por tabla en este navegador; la página vuelve a 1 cuando cambian los filtros. */
import { useState } from 'react';

export const PAGE_SIZES = [25, 50, 100] as const;

function readSize(id: string): number {
  try {
    const v = Number(localStorage.getItem(`siven.pageSize.${id}`));
    return (PAGE_SIZES as readonly number[]).includes(v) ? v : 25;
  } catch {
    return 25;
  }
}

export function usePaged<T>(rows: T[], resetKey: string, id: string) {
  const [state, setState] = useState(() => ({ key: resetKey, page: 1, size: readSize(id) }));
  const size = state.size;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = state.key === resetKey ? Math.min(state.page, pages) : 1;
  const setPage = (p: number) => setState((s) => ({ ...s, key: resetKey, page: Math.max(1, Math.min(p, pages)) }));
  const setSize = (n: number) => {
    try {
      localStorage.setItem(`siven.pageSize.${id}`, String(n));
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
    setState({ key: resetKey, page: 1, size: n });
  };
  const start = (page - 1) * size;
  return { pageRows: rows.slice(start, start + size), page, pages, size, setPage, setSize, total: rows.length, start };
}

/** Lo que necesita el control de paginación (sirve también para listas paginadas por el servidor). */
export interface PagerState {
  page: number;
  pages: number;
  size: number;
  total: number;
  start: number;
  setPage(p: number): void;
  setSize(n: number): void;
}
