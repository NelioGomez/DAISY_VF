import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { cost4, Decimal, fixed4 } from '../common/utils/money';
import { weightedAverageCost } from './average-cost';

export const MAX_STOCK = 2_000_000_000;

export interface MovementContext {
  userId: string;
  supplierId?: string | null;
  reference?: string | null;
  note?: string | null;
  sourceEntity?: string | null;
  sourceId?: string | null;
}

interface LockedProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  avgCost: Decimal;
}

export interface MovementResult {
  movement: {
    id: string;
    productId: string;
    type: InventoryMovementType;
    quantity: number;
    unitCost: { toString(): string };
    stockBefore: number;
    stockAfter: number;
    createdAt: Date;
  };
  product: { id: string; sku: string; name: string; stock: number; avgCost: Decimal };
}

/**
 * ÚNICO punto que modifica stock y costo promedio. Siempre recibe la transacción
 * del llamador para que el movimiento y el cambio de stock sean atómicos.
 *
 * Concurrencia: SELECT … FOR UPDATE sobre los productos (en orden de id, para evitar
 * interbloqueos) y lectura posterior de los valores ya bloqueados.
 */
@Injectable()
export class StockService {
  /** Bloquea y lee los productos. Los ids se ordenan para que dos transacciones nunca se crucen. */
  async lockProducts(tx: Prisma.TransactionClient, ids: string[]): Promise<Map<string, LockedProduct>> {
    const sorted = [...new Set(ids)].sort();
    for (const id of sorted) {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`;
    }
    const rows = (await tx.product.findMany({
      where: { id: { in: sorted } },
      select: { id: true, sku: true, name: true, stock: true, avgCost: true },
    })) as { id: string; sku: string; name: string; stock: number; avgCost: { toString(): string } }[];

    const map = new Map<string, LockedProduct>();
    for (const r of rows) map.set(r.id, { ...r, avgCost: new Decimal(r.avgCost.toString()) });
    return map;
  }

  async registerEntry(
    tx: Prisma.TransactionClient,
    input: { productId: string; quantity: number; unitCost: Decimal.Value } & MovementContext,
  ): Promise<MovementResult> {
    this.assertQuantity(input.quantity);
    const p = await this.lockOne(tx, input.productId);
    const stockAfter = p.stock + input.quantity;
    if (stockAfter > MAX_STOCK) throw this.overflow(p.sku);
    const unitCost = cost4(input.unitCost);
    const newAvg = weightedAverageCost(p.stock, p.avgCost, input.quantity, unitCost);
    return this.apply(tx, p, InventoryMovementType.ENTRY, input.quantity, unitCost, stockAfter, newAvg, input);
  }

  async registerExit(
    tx: Prisma.TransactionClient,
    input: { productId: string; quantity: number } & MovementContext,
  ): Promise<MovementResult> {
    const [res] = await this.registerExits(tx, [{ productId: input.productId, quantity: input.quantity }], input);
    return res;
  }

  /**
   * Salida de varios productos a la vez (ventas). Valida TODOS antes de modificar nada y
   * reporta cada faltante con el índice de su línea. El costo de salida es el promedio vigente.
   */
  async registerExits(
    tx: Prisma.TransactionClient,
    lines: { productId: string; quantity: number }[],
    ctx: MovementContext,
    fieldPrefix = 'items',
  ): Promise<MovementResult[]> {
    lines.forEach((l) => this.assertQuantity(l.quantity));
    const locked = await this.lockProducts(
      tx,
      lines.map((l) => l.productId),
    );

    const errors: { field: string; message: string }[] = [];
    lines.forEach((l, i) => {
      const p = locked.get(l.productId);
      if (!p) errors.push({ field: `${fieldPrefix}[${i}].productId`, message: 'El producto no existe' });
      else if (p.stock < l.quantity) {
        errors.push({
          field: `${fieldPrefix}[${i}].quantity`,
          message: `Stock insuficiente de ${p.sku}: disponible ${p.stock}, solicitado ${l.quantity}`,
        });
      }
    });
    if (errors.length) {
      throw new ConflictException({ message: 'Stock insuficiente para completar la operación', errors });
    }

    const results: MovementResult[] = [];
    for (const l of lines) {
      const p = locked.get(l.productId)!;
      results.push(
        await this.apply(tx, p, InventoryMovementType.EXIT, l.quantity, p.avgCost, p.stock - l.quantity, p.avgCost, ctx),
      );
    }
    return results;
  }

  /** Ajuste a un stock absoluto contado (inventario físico). El costo promedio no cambia. */
  async registerAdjustment(
    tx: Prisma.TransactionClient,
    input: { productId: string; newStock: number } & MovementContext,
  ): Promise<MovementResult> {
    if (!Number.isInteger(input.newStock) || input.newStock < 0 || input.newStock > MAX_STOCK) {
      throw new BadRequestException({
        message: 'Ajuste inválido',
        errors: [{ field: 'newStock', message: 'El stock contado debe ser un entero entre 0 y 2.000.000.000' }],
      });
    }
    const p = await this.lockOne(tx, input.productId);
    const diff = Math.abs(input.newStock - p.stock);
    if (diff === 0) {
      throw new BadRequestException({
        message: 'El ajuste no cambia el stock',
        errors: [{ field: 'newStock', message: `El stock actual ya es ${p.stock}` }],
      });
    }
    return this.apply(tx, p, InventoryMovementType.ADJUSTMENT, diff, p.avgCost, input.newStock, p.avgCost, input);
  }

  // ───────────────────────── internos ─────────────────────────

  private async lockOne(tx: Prisma.TransactionClient, productId: string): Promise<LockedProduct> {
    const p = (await this.lockProducts(tx, [productId])).get(productId);
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  private async apply(
    tx: Prisma.TransactionClient,
    p: LockedProduct,
    type: InventoryMovementType,
    quantity: number,
    unitCost: Decimal,
    stockAfter: number,
    newAvg: Decimal,
    ctx: MovementContext,
  ): Promise<MovementResult> {
    await tx.product.update({
      where: { id: p.id },
      data: { stock: stockAfter, avgCost: fixed4(newAvg), version: { increment: 1 } },
    });
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: p.id,
        type,
        quantity,
        unitCost: fixed4(unitCost),
        stockBefore: p.stock,
        stockAfter,
        reference: ctx.reference ?? null,
        note: ctx.note ?? null,
        userId: ctx.userId,
        supplierId: ctx.supplierId ?? null,
        sourceEntity: ctx.sourceEntity ?? null,
        sourceId: ctx.sourceId ?? null,
      },
    });
    return {
      movement,
      product: { id: p.id, sku: p.sku, name: p.name, stock: stockAfter, avgCost: newAvg },
    };
  }

  private assertQuantity(q: number) {
    if (!Number.isInteger(q) || q <= 0) {
      throw new BadRequestException({
        message: 'Cantidad inválida',
        errors: [{ field: 'quantity', message: 'La cantidad debe ser un entero mayor que cero' }],
      });
    }
  }

  private overflow(sku: string) {
    return new BadRequestException({
      message: 'Cantidad fuera de rango',
      errors: [{ field: 'quantity', message: `El stock de ${sku} superaría el máximo permitido` }],
    });
  }
}
