/* Columnas configurables (mejora n.° 21): cada tabla declara sus columnas y el usuario puede
   mostrarlas, ocultarlas y reordenarlas desde el botón "Columnas". La preferencia se guarda por
   tabla en este navegador; "Restablecer" vuelve al orden original. */
import { useMemo, useState, type ReactNode, type TdHTMLAttributes } from 'react';

export interface Column<T> {
  id: string;
  /** Encabezado y nombre en el menú "Columnas". */
  label: string;
  /** Encabezado con formato propio (si no, se usa `label`). */
  header?: ReactNode;
  cell: (row: T) => ReactNode;
  /** Clase del encabezado y de la celda (p. ej. "num" para importes). */
  className?: string;
  /** Clase solo de la celda (p. ej. "mono" para códigos). */
  cellClass?: string;
  tdProps?: (row: T) => TdHTMLAttributes<HTMLTableCellElement>;
  /** No se puede ocultar (el código o el nombre del registro). */
  required?: boolean;
  /** Oculta al inicio; se puede mostrar desde "Columnas". */
  hidden?: boolean;
}

interface Saved {
  order: string[];
  hidden: string[];
}

const storageKey = (tableId: string) => `siven.columnas.${tableId}`;

function readSaved(tableId: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(tableId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Saved>;
    return Array.isArray(v.order) && Array.isArray(v.hidden) ? { order: v.order.map(String), hidden: v.hidden.map(String) } : null;
  } catch {
    return null;
  }
}

function writeSaved(tableId: string, v: Saved | null): void {
  try {
    if (v) localStorage.setItem(storageKey(tableId), JSON.stringify(v));
    else localStorage.removeItem(storageKey(tableId));
  } catch {
    /* modo privado o almacenamiento bloqueado: la preferencia dura solo esta visita */
  }
}

export interface ColumnsApi<T> {
  visible: Column<T>[];
  all: Array<Column<T> & { shown: boolean }>;
  customized: boolean;
  toggle(id: string): void;
  move(id: string, dir: -1 | 1): void;
  reset(): void;
}

export function useColumns<T>(tableId: string, columns: Column<T>[]): ColumnsApi<T> {
  const [saved, setSaved] = useState<Saved | null>(() => readSaved(tableId));
  const ids = columns.map((c) => c.id);
  const idsKey = ids.join('|');

  // Orden guardado + columnas nuevas (de una versión posterior) en su posición original.
  const order = useMemo(() => {
    const def = idsKey.split('|');
    if (!saved) return def;
    const out = saved.order.filter((id) => def.includes(id));
    for (const id of def) if (!out.includes(id)) out.splice(Math.min(def.indexOf(id), out.length), 0, id);
    return out;
  }, [saved, idsKey]);

  const byId = new Map(columns.map((c) => [c.id, c]));
  const hidden = new Set(saved ? saved.hidden : columns.filter((c) => c.hidden).map((c) => c.id));
  const all = order.map((id) => {
    const c = byId.get(id)!;
    return { ...c, shown: !!c.required || !hidden.has(id) };
  });

  const update = (next: Saved | null) => {
    setSaved(next);
    writeSaved(tableId, next);
  };

  return {
    visible: all.filter((c) => c.shown),
    all,
    customized: saved !== null,
    toggle(id) {
      if (byId.get(id)?.required) return;
      const h = new Set(hidden);
      if (h.has(id)) h.delete(id);
      else h.add(id);
      update({ order, hidden: [...h] });
    },
    move(id, dir) {
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      const o = [...order];
      [o[i], o[j]] = [o[j], o[i]];
      update({ order: o, hidden: [...hidden] });
    },
    reset() {
      update(null);
    },
  };
}

