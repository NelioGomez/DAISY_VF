import { QuotationStatus } from '../generated/prisma/client';

/**
 * Ciclo de vida de una cotización:
 *   BORRADOR → PENDIENTE → APROBADA → CONVERTIDA (en venta)
 *   PENDIENTE/APROBADA → RECHAZADA
 *   BORRADOR/PENDIENTE/APROBADA → VENCIDA (automático al pasar la fecha de validez)
 * CONVERTIDA, RECHAZADA y VENCIDA son estados finales.
 */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: [QuotationStatus.PENDING, QuotationStatus.EXPIRED],
  PENDING: [QuotationStatus.APPROVED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED],
  APPROVED: [QuotationStatus.CONVERTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED],
  REJECTED: [],
  CONVERTED: [],
  EXPIRED: [],
};

export const canTransition = (from: QuotationStatus, to: QuotationStatus): boolean =>
  QUOTATION_TRANSITIONS[from].includes(to);

/** Solo se pueden editar los datos mientras no haya sido aprobada. */
export const isEditable = (s: QuotationStatus): boolean =>
  s === QuotationStatus.DRAFT || s === QuotationStatus.PENDING;

export const OPEN_STATUSES: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.PENDING,
  QuotationStatus.APPROVED,
];
