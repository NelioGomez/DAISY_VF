/* Filtros avanzados de una lista (mejoras n.° 18 y 19): búsqueda, filtros por campo y rango de
   fechas, con los filtros activos listos para mostrarse como chips removibles.
   - useFilterState: solo el estado (para listas que filtra el servidor).
   - useListFilters: estado + filtrado en el cliente de las filas ya cargadas. */
import { useMemo, useState } from 'react';
import { localDay, matches } from '../utils/format';

export interface FilterOption {
  value: string;
  label: string;
}

export interface SelectDef {
  key: string;
  /** Nombre del filtro: "Categoría", "Estado"… */
  label: string;
  options: FilterOption[];
}

export interface SelectFilter<T> extends SelectDef {
  test(row: T, value: string): boolean;
}

export interface ActiveFilter {
  key: string;
  label: string;
  clear(): void;
}

const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });

export function useFilterState(selects: SelectDef[], hasDate: boolean, initial: Record<string, string> = {}) {
  const [q, setQ] = useState('');
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const setValue = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const active: ActiveFilter[] = [
    ...(q.trim() ? [{ key: 'q', label: `Búsqueda: "${q.trim()}"`, clear: () => setQ('') }] : []),
    ...selects
      .filter((f) => values[f.key])
      .map((f) => ({
        key: f.key,
        label: `${f.label}: ${f.options.find((o) => o.value === values[f.key])?.label ?? values[f.key]}`,
        clear: () => setValue(f.key, ''),
      })),
    ...(desde ? [{ key: 'desde', label: `Desde ${fmtDay(desde)}`, clear: () => setDesde('') }] : []),
    ...(hasta ? [{ key: 'hasta', label: `Hasta ${fmtDay(hasta)}`, clear: () => setHasta('') }] : []),
  ];
  const clear = () => {
    setQ('');
    setValues({});
    setDesde('');
    setHasta('');
  };
  /** Cambia con cualquier filtro: la paginación vuelve a la página 1. */
  const key = JSON.stringify([q, values, desde, hasta]);
  return { q, setQ, values, setValue, desde, setDesde, hasta, setHasta, active, clear, key, selects, hasDate };
}

export type FilterState = ReturnType<typeof useFilterState>;

export interface ListFilterConfig<T> {
  /** Textos de la fila donde busca el cuadro de búsqueda. */
  search(row: T): Array<string | number | null | undefined>;
  selects?: SelectFilter<T>[];
  /** Fecha de la fila (ISO) para el filtro "desde / hasta". */
  date?(row: T): string | null | undefined;
  /** Valores iniciales (p. ej. desde un parámetro de la URL). */
  initial?: Record<string, string>;
}

const NO_SELECTS: never[] = [];

export function useListFilters<T>(rows: T[], config: ListFilterConfig<T>) {
  const { search, selects = NO_SELECTS as SelectFilter<T>[], date, initial } = config;
  const state = useFilterState(selects, !!date, initial);
  const { q, values, desde, hasta } = state;

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!matches(q, ...search(r))) return false;
        for (const f of selects) {
          const v = values[f.key];
          if (v && !f.test(r, v)) return false;
        }
        if (date && (desde || hasta)) {
          const d = date(r);
          if (!d) return false;
          const day = localDay(d);
          if (desde && day < desde) return false;
          if (hasta && day > hasta) return false;
        }
        return true;
      }),
    [rows, q, values, desde, hasta, search, selects, date],
  );

  return { ...state, filtered, count: { shown: filtered.length, total: rows.length } };
}
