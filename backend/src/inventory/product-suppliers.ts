import { fixed4, Decimal } from '../common/utils/money';
import type { Currency, Prisma } from '../generated/prisma/client';

/**
 * Recuerda qué proveedor surte el producto y a qué costo lo vendió la última vez (en su moneda).
 * Si el producto aún no tiene proveedor preferente, este queda como preferente: así el panel de
 * reabastecimiento puede proponer a quién comprar. Debe llamarse dentro de la transacción que
 * registra la entrada, con el producto ya bloqueado (FOR UPDATE), para que dos entradas
 * simultáneas no marquen dos preferentes (índice único parcial product_suppliers_preferred_key).
 */
export async function rememberSupplierCost(
  tx: Prisma.TransactionClient,
  input: { productId: string; supplierId: string; unitCost: Decimal.Value; currency: Currency },
): Promise<void> {
  const key = { productId_supplierId: { productId: input.productId, supplierId: input.supplierId } };
  const lastCost = fixed4(input.unitCost);
  const existing = await tx.productSupplier.findUnique({ where: key, select: { productId: true } });
  if (existing) {
    await tx.productSupplier.update({ where: key, data: { lastCost, currency: input.currency } });
    return;
  }
  const preferred = await tx.productSupplier.findFirst({
    where: { productId: input.productId, isPreferred: true },
    select: { supplierId: true },
  });
  await tx.productSupplier.create({
    data: {
      productId: input.productId,
      supplierId: input.supplierId,
      lastCost,
      currency: input.currency,
      isPreferred: !preferred,
    },
  });
}
