/**
 * Documento que originó un movimiento de inventario (trazabilidad navegable, mejora n.° 50):
 * la venta (salida, o entrada por anulación), la recepción de compra (entrada), la orden de
 * producción (consumo de materiales, o entrada del lote liberado por calidad) o el traslado
 * entre la bodega y la sucursal.
 * Archivo sin dependencias de servicios para poder usarlo desde Inventario y Productos.
 */
export const MOVEMENT_ORIGIN_INCLUDE = {
  sale: { select: { id: true, invoiceNumber: true } },
  purchaseReceiptItem: {
    select: { receipt: { select: { id: true, code: true, purchase: { select: { id: true, code: true } } } } },
  },
  productionOrder: { select: { id: true, code: true } },
  productionLot: { select: { id: true, code: true } },
  transfer: { select: { id: true, code: true } },
} as const;

export interface MovementOriginRow {
  sale?: { id: string; invoiceNumber: string } | null;
  purchaseReceiptItem?: { receipt: { id: string; code: string; purchase: { id: string; code: string } } } | null;
  productionOrder?: { id: string; code: string } | null;
  productionLot?: { id: string; code: string } | null;
  transfer?: { id: string; code: string } | null;
}

export function movementOrigin(m: MovementOriginRow) {
  if (m.sale) return { type: 'SALE' as const, id: m.sale.id, code: m.sale.invoiceNumber };
  const r = m.purchaseReceiptItem?.receipt;
  if (r) return { type: 'RECEIPT' as const, id: r.id, code: r.code, purchaseId: r.purchase.id, purchaseCode: r.purchase.code };
  const op = m.productionOrder;
  if (op) return { type: 'PRODUCTION' as const, id: op.id, code: op.code, lotCode: m.productionLot?.code ?? null };
  if (m.transfer) return { type: 'TRANSFER' as const, id: m.transfer.id, code: m.transfer.code };
  return null;
}
