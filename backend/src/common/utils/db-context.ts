import type { Prisma } from '../../generated/prisma/client';

/**
 * Indica a los triggers de la base quién hace el cambio y por qué. set_config(..., true) solo
 * dura lo que la transacción, así que debe llamarse dentro del mismo $transaction que modifica.
 * Lo usa trg_products_price_history para registrar el historial de precios.
 */
export async function setPriceContext(tx: Prisma.TransactionClient, userId: string, reason: string): Promise<void> {
  await tx.$queryRaw`SELECT set_config('app.user_id', ${userId}, true), set_config('app.price_reason', ${reason.slice(0, 255)}, true)`;
}
