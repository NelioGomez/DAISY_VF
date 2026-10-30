/**
 * Documento que originó un movimiento de inventario (trazabilidad navegable, mejora n.° 50):
 * la venta (salida, o entrada por anulación) o la recepción de compra (entrada).
 * Archivo sin dependencias de servicios para poder usarlo desde Inventario y Productos.
 */
export const MOVEMENT_ORIGIN_INCLUDE = {
  sale: { select: { id: true, invoiceNumber: true } },
  purchaseReceiptItem: {
    select: { receipt: { select: { id: true, code: true, purchase: { select: { id: true, code: true } } } } },
  },
} as const;

export interface MovementOriginRow {
  sale?: { id: string; invoiceNumber: string } | null;
  purchaseReceiptItem?: { receipt: { id: string; code: string; purchase: { id: string; code: string } } } | null;
}

export function movementOrigin(m: MovementOriginRow) {
  if (m.sale) return { type: 'SALE' as const, id: m.sale.id, code: m.sale.invoiceNumber };
  const r = m.purchaseReceiptItem?.receipt;
  if (r) return { type: 'RECEIPT' as const, id: r.id, code: r.code, purchaseId: r.purchase.id, purchaseCode: r.purchase.code };
  return null;
}
