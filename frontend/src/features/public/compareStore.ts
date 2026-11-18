/* Comparador de productos (mejora n.° 38) y vista rápida (n.° 34) del catálogo público.
   La selección para comparar (hasta 4) se guarda en la pestaña del navegador mientras se
   recorre el catálogo; la vista rápida es el producto abierto en la ventana emergente. */
import { useSyncExternalStore } from 'react';
import type { ProductoPublico } from '../../types';

export const MAX_COMPARE = 4;
const KEY = 'siven.comparar';

export type CompareItem = Pick<ProductoPublico, 'id' | 'nombre' | 'sku' | 'imagen' | 'categoria'>;

function load(): CompareItem[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as CompareItem[];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string').slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

let items: CompareItem[] = load();
let quick: ProductoPublico | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

function save(next: CompareItem[]) {
  items = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento bloqueado: la selección dura hasta recargar */
  }
  emit();
}

export const compareStore = {
  get: () => items,
  /** Agrega o quita; devuelve false si ya hay 4 y se intentó agregar otro. */
  toggle(p: ProductoPublico | CompareItem): boolean {
    if (items.some((x) => x.id === p.id)) {
      save(items.filter((x) => x.id !== p.id));
      return true;
    }
    if (items.length >= MAX_COMPARE) return false;
    save([...items, { id: p.id, nombre: p.nombre, sku: p.sku, imagen: p.imagen, categoria: p.categoria }]);
    return true;
  },
  remove(id: string) {
    save(items.filter((x) => x.id !== id));
  },
  clear() {
    save([]);
  },
};

export function useCompare() {
  const list = useSyncExternalStore(subscribe, () => items);
  return {
    items: list,
    has: (id: string) => list.some((x) => x.id === id),
    full: list.length >= MAX_COMPARE,
    ...compareStore,
  };
}

export const quickView = {
  open(p: ProductoPublico) {
    quick = p;
    emit();
  },
  close() {
    quick = null;
    emit();
  },
};

export const useQuickView = (): ProductoPublico | null => useSyncExternalStore(subscribe, () => quick);
