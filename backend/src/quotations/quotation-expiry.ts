import { QuotationStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { OPEN_STATUSES } from './quotation-status';

/**
 * Vencimiento "perezoso": en lugar de un proceso programado, las cotizaciones abiertas
 * cuya fecha de validez ya pasó se marcan VENCIDA justo antes de consultarlas o usarlas.
 */
export async function expireOverdueQuotations(prisma: Prisma.TransactionClient): Promise<number> {
  const res = await prisma.quotation.updateMany({
    where: { status: { in: OPEN_STATUSES }, validUntil: { lt: new Date() } },
    data: { status: QuotationStatus.EXPIRED },
  });
  return res.count;
}
