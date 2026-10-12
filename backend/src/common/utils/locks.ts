import type { Prisma } from '../../generated/prisma/client';

/**
 * Bloqueos de fila (SELECT … FOR UPDATE) para serializar operaciones concurrentes
 * sobre el mismo documento. Solo dentro de una transacción interactiva.
 */
export const lockSale = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM sales WHERE id = ${id}::uuid FOR UPDATE`;

export const lockQuotation = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM quotations WHERE id = ${id}::uuid FOR UPDATE`;

export const lockServiceOrder = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM service_orders WHERE id = ${id}::uuid FOR UPDATE`;

export const TX_OPTIONS = { maxWait: 5_000, timeout: 20_000 } as const;