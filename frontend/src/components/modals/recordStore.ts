/* Registro abierto en el panel lateral (mejoras n.° 32 y 33).
   Lo leen la barra superior (ruta Inicio › Módulo › Registro) y la sincronización con la
   dirección del navegador (?venta=<id>, ?producto=<id>…). Es un estado de módulo porque el
   panel se dibuja en #modalRoot, fuera del layout que muestra la ruta. */

export interface OpenRecord {
  /** "tipo:id" del registro visible, o null si no hay panel abierto. */
  key: string | null;
  /** Código o nombre para la ruta (FAC-000125, SKU, cliente…); null mientras carga. */
  label: string | null;
}

let state: OpenRecord = { key: null, label: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const recordStore = {
  get: (): OpenRecord => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  open(key: string): void {
    if (state.key === key) return;
    state = { key, label: null };
    emit();
  },
  close(key: string): void {
    if (state.key !== key) return;
    state = { key: null, label: null };
    emit();
  },
  label(key: string, label: string): void {
    if (state.key !== key || state.label === label) return;
    state = { ...state, label };
    emit();
  },
};
