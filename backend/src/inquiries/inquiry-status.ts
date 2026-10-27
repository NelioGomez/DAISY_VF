import { InquiryStatus } from '../generated/prisma/client';

/**
 * Solicitud web (se conserva siempre como evidencia):
 *   NUEVA → EN REVISIÓN → COTIZADA → CERRADA
 *   NUEVA / EN REVISIÓN → CERRADA (atendida sin cotización)
 *   NUEVA / EN REVISIÓN → CANCELADA (spam, duplicada, datos falsos)
 * COTIZADA la marca el sistema al generar una cotización desde la solicitud.
 */
export const INQUIRY_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  NEW: [InquiryStatus.IN_REVIEW, InquiryStatus.QUOTED, InquiryStatus.CLOSED, InquiryStatus.CANCELLED],
  IN_REVIEW: [InquiryStatus.QUOTED, InquiryStatus.CLOSED, InquiryStatus.CANCELLED],
  QUOTED: [InquiryStatus.CLOSED],
  CLOSED: [],
  CANCELLED: [],
};

/** Estados que una persona puede fijar a mano (QUOTED solo al crear la cotización). */
export const MANUAL_INQUIRY_STATUSES: InquiryStatus[] = [
  InquiryStatus.IN_REVIEW,
  InquiryStatus.CLOSED,
  InquiryStatus.CANCELLED,
];

export const canMoveInquiry = (from: InquiryStatus, to: InquiryStatus): boolean =>
  INQUIRY_TRANSITIONS[from].includes(to);
