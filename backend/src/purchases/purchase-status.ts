import { PurchaseStatus } from '../generated/prisma/client';

/**
 * Ciclo de una compra:
 *   BORRADOR → ORDENADA (pendiente de recibir) → PARCIALMENTE RECIBIDA → RECIBIDA
 *   BORRADOR / ORDENADA / PARCIALMENTE RECIBIDA → CANCELADA (con motivo)
 * Cancelar una compra parcialmente recibida cancela solo lo pendiente: lo ya recibido
 * quedó en inventario y sus entradas no se tocan (la bitácora es de solo inserción).
 */
export const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT: [PurchaseStatus.ORDERED, PurchaseStatus.CANCELLED],
  ORDERED: [PurchaseStatus.PARTIALLY_RECEIVED, PurchaseStatus.RECEIVED, PurchaseStatus.CANCELLED],
  PARTIALLY_RECEIVED: [PurchaseStatus.PARTIALLY_RECEIVED, PurchaseStatus.RECEIVED, PurchaseStatus.CANCELLED],
  RECEIVED: [],
  CANCELLED: [],
};

export const canMovePurchase = (from: PurchaseStatus, to: PurchaseStatus): boolean =>
  PURCHASE_TRANSITIONS[from].includes(to);

/** Se puede registrar mercadería solo en compras ordenadas o con saldo por recibir. */
export const canReceive = (s: PurchaseStatus): boolean =>
  s === PurchaseStatus.ORDERED || s === PurchaseStatus.PARTIALLY_RECEIVED;
