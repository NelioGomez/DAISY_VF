/* Registros que se consultan en el panel lateral (mejora n.° 33) y que tienen dirección propia
   en el navegador (mejora n.° 32): /app/ventas?venta=<id>, /app/productos?producto=<id>…
   El enlace se puede copiar o recargar, el botón Atrás del navegador cierra el panel y la
   barra superior muestra la ruta Inicio › Módulo › Registro. */
import { useCallback, type ReactNode } from 'react';
import { RecordPanel } from '../../components/modals/RecordPanel';
import { useModal } from '../../components/modals/useModal';
import { useAuth } from '../../store/hooks';
import { CustomerDrawer } from '../customers/CustomerDrawer';
import { TransferDetailModal } from '../inventory/TransferDetailModal';
import { LotDetailModal } from '../production/LotDetailModal';
import { OrderDetailModal } from '../production/OrderDetailModal';
import { ProductDrawer } from '../products/ProductDrawer';
import { PurchaseDetailModal } from '../purchases/PurchaseDetailModal';
import { QuotationDetailModal } from '../quotations/QuotationDetailModal';
import { InvoiceModal } from '../sales/InvoiceModal';
import { SupplierDrawer } from '../suppliers/SupplierDrawer';
import { InquiryDetailModal } from '../web-inquiries/InquiryDetailModal';

export type RecordTipo = 'venta' | 'cotizacion' | 'solicitud' | 'compra' | 'produccion' | 'lote' | 'traslado' | 'producto' | 'cliente' | 'proveedor';

const DEFS: Record<RecordTipo, { perm: string; render: (id: string) => ReactNode }> = {
  venta: { perm: 'sales:read', render: (id) => <InvoiceModal ventaId={id} /> },
  cotizacion: { perm: 'quotations:read', render: (id) => <QuotationDetailModal cotizacionId={id} /> },
  solicitud: { perm: 'inquiries:read', render: (id) => <InquiryDetailModal consultaId={id} /> },
  compra: { perm: 'purchases:read', render: (id) => <PurchaseDetailModal compraId={id} /> },
  produccion: { perm: 'production:read', render: (id) => <OrderDetailModal ordenId={id} /> },
  lote: { perm: 'production:read', render: (id) => <LotDetailModal loteId={id} /> },
  traslado: { perm: 'inventory:read', render: (id) => <TransferDetailModal trasladoId={id} /> },
  producto: { perm: 'products:read', render: (id) => <ProductDrawer productoId={id} /> },
  cliente: { perm: 'customers:read', render: (id) => <CustomerDrawer clienteId={id} /> },
  proveedor: { perm: 'suppliers:read', render: (id) => <SupplierDrawer proveedorId={id} /> },
};

export const RECORD_TIPOS = Object.keys(DEFS) as RecordTipo[];

export const recordKey = (tipo: RecordTipo, id: string): string => `${tipo}:${id}`;

const ID_RE = /^[0-9a-f-]{36}$/i;

/** Lee el registro de la dirección (?venta=<uuid>…); null si no hay uno válido. */
export function parseRecordParam(search: string): { tipo: RecordTipo; id: string } | null {
  const params = new URLSearchParams(search);
  for (const tipo of RECORD_TIPOS) {
    const id = params.get(tipo);
    if (id && ID_RE.test(id)) return { tipo, id };
  }
  return null;
}

/** Devuelve la búsqueda sin parámetros de registro y, si se indica, con el nuevo. */
export function withRecordParam(search: string, rec: { tipo: RecordTipo; id: string } | null): string {
  const params = new URLSearchParams(search);
  for (const tipo of RECORD_TIPOS) params.delete(tipo);
  if (rec) params.set(rec.tipo, rec.id);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function renderRecord(tipo: RecordTipo, id: string): ReactNode {
  const key = recordKey(tipo, id);
  return (
    <RecordPanel key={key} recordKey={key}>
      {DEFS[tipo].render(id)}
    </RecordPanel>
  );
}

/** Abre un registro en el panel lateral si el rol puede verlo. */
export function useRecords() {
  const modal = useModal();
  const { can } = useAuth();
  const canOpenRecord = useCallback((tipo: RecordTipo) => can(DEFS[tipo].perm), [can]);
  const openRecord = useCallback(
    (tipo: RecordTipo, id: string) => {
      if (canOpenRecord(tipo)) modal.open(renderRecord(tipo, id));
    },
    [canOpenRecord, modal],
  );
  return { openRecord, canOpenRecord };
}
