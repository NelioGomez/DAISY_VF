/* Contexto del panel de registro (mejoras n.° 32 y 33); ver RecordPanel.tsx. */
import { createContext, useContext, useEffect } from 'react';
import { recordStore } from './recordStore';

/** "tipo:id" del registro que se está mostrando; null fuera de un panel de registro. */
export const RecordContext = createContext<string | null>(null);

/** Fija el texto del registro en la ruta de la barra superior (p. ej. "Factura FAC-000125"). */
export function useRecordLabel(label: string | null | undefined): void {
  const key = useContext(RecordContext);
  useEffect(() => {
    if (key && label) recordStore.label(key, label);
  }, [key, label]);
}

export const useInRecord = (): boolean => useContext(RecordContext) !== null;
