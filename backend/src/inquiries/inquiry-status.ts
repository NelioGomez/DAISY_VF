import { InquiryStatus } from '../generated/prisma/client';

/** NUEVA → ATENDIDA → CERRADA; una nueva también puede cerrarse directamente (spam, duplicada). */
export const INQUIRY_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  NEW: [InquiryStatus.ATTENDED, InquiryStatus.CLOSED],
  ATTENDED: [InquiryStatus.CLOSED],
  CLOSED: [],
};

export const canMoveInquiry = (from: InquiryStatus, to: InquiryStatus): boolean =>
  INQUIRY_TRANSITIONS[from].includes(to);