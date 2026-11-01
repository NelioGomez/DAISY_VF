/* Abre el documento relacionado (factura, cotización, solicitud, compra, orden de producción,
   lote o traslado) en el panel lateral de registro (mejoras n.° 32 y 33), siempre que el
   usuario pueda leer ese módulo. Lo usan las cadenas de trazabilidad, la bitácora y la búsqueda. */
import { useCallback } from 'react';
import type { DocumentoRef } from '../../types';
import { useRecords, type RecordTipo } from '../records/records';

const RECORD: Record<DocumentoRef['tipo'], RecordTipo | null> = {
  VENTA: 'venta',
  PAGO: 'venta',
  COTIZACION: 'cotizacion',
  SOLICITUD: 'solicitud',
  COMPRA: 'compra',
  RECEPCION: 'compra',
  MOVIMIENTO: null,
  PRODUCCION: 'produccion',
  LOTE: 'lote',
  TRASLADO: 'traslado',
};

export function useOpenDocument() {
  const { openRecord, canOpenRecord } = useRecords();

  const canOpen = useCallback(
    (ref: Pick<DocumentoRef, 'tipo' | 'compraId'>) => {
      const tipo = RECORD[ref.tipo];
      if (!tipo || !canOpenRecord(tipo)) return false;
      return ref.tipo !== 'RECEPCION' || !!ref.compraId;
    },
    [canOpenRecord],
  );

  const open = useCallback(
    (ref: DocumentoRef) => {
      const tipo = RECORD[ref.tipo];
      if (!tipo || !canOpen(ref)) return;
      openRecord(tipo, ref.tipo === 'RECEPCION' ? ref.compraId! : ref.id);
    },
    [canOpen, openRecord],
  );

  return { open, canOpen };
}
