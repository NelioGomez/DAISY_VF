/* Abre el documento relacionado (factura, cotización, solicitud, compra, orden de producción o
   lote) en su ventana de detalle, siempre que el usuario pueda leer ese módulo. Lo usan las
   cadenas de trazabilidad y la bitácora. */
import { useCallback } from 'react';
import { useModal } from '../../components/modals/useModal';
import { useAuth } from '../../store/hooks';
import type { DocumentoRef } from '../../types';
import { LotDetailModal } from '../production/LotDetailModal';
import { OrderDetailModal } from '../production/OrderDetailModal';
import { PurchaseDetailModal } from '../purchases/PurchaseDetailModal';
import { InvoiceModal } from '../sales/InvoiceModal';
import { QuotationDetailModal } from '../quotations/QuotationDetailModal';
import { InquiryDetailModal } from '../web-inquiries/InquiryDetailModal';

const PERMISSION: Record<DocumentoRef['tipo'], string | null> = {
  VENTA: 'sales:read',
  PAGO: 'sales:read',
  COTIZACION: 'quotations:read',
  SOLICITUD: 'inquiries:read',
  COMPRA: 'purchases:read',
  RECEPCION: 'purchases:read',
  MOVIMIENTO: null,
  PRODUCCION: 'production:read',
  LOTE: 'production:read',
};

export function useOpenDocument() {
  const modal = useModal();
  const { can } = useAuth();

  const canOpen = useCallback(
    (ref: Pick<DocumentoRef, 'tipo' | 'compraId'>) => {
      const perm = PERMISSION[ref.tipo];
      if (!perm || !can(perm)) return false;
      return ref.tipo !== 'RECEPCION' || !!ref.compraId;
    },
    [can],
  );

  const open = useCallback(
    (ref: DocumentoRef) => {
      if (!canOpen(ref)) return;
      switch (ref.tipo) {
        case 'VENTA':
        case 'PAGO':
          return modal.open(<InvoiceModal ventaId={ref.id} />);
        case 'COTIZACION':
          return modal.open(<QuotationDetailModal cotizacionId={ref.id} />);
        case 'SOLICITUD':
          return modal.open(<InquiryDetailModal consultaId={ref.id} />);
        case 'COMPRA':
          return modal.open(<PurchaseDetailModal compraId={ref.id} />);
        case 'RECEPCION':
          return modal.open(<PurchaseDetailModal compraId={ref.compraId!} />);
        case 'PRODUCCION':
          return modal.open(<OrderDetailModal ordenId={ref.id} />);
        case 'LOTE':
          return modal.open(<LotDetailModal loteId={ref.id} />);
        default:
          return undefined;
      }
    },
    [canOpen, modal],
  );

  return { open, canOpen };
}
