import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LOCATION_NAME, MAIN_WAREHOUSE_ID } from '../common/constants/locations';
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
  /** Venta que origina el movimiento (salida al vender o entrada al anular). */
  saleId?: string | null;
  /** Línea de recepción de compra que origina la entrada (relación 1:1). */
  purchaseReceiptItemId?: string | null;
  /** Orden de producción: consumo de materiales (salida) o producto terminado (entrada). */
  productionOrderId?: string | null;
  /** Lote liberado por calidad que origina la entrada del producto terminado. */
  productionLotId?: string | null;
  /** Traslado entre ubicaciones (salida en el origen y entrada en el destino). */
  transferId?: string | null;
  /** Dónde ocurre: entradas y ajustes quedan aquí; las salidas salen de aquí. Por defecto, la Bodega principal. */
  locationId?: number;
}

interface LockedProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  avgCost: Decimal;
  /** Existencia en cada ubicación (la suma es `stock`). */
  byLocation: Map<number, number>;
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
    locationId?: number;
    createdAt: Date;
  };
  product: { id: string; sku: string; name: string; stock: number; avgCost: Decimal };
  /** Si una salida se tomó de dos ubicaciones, cada parte (la primera también está en `movement`). */
  parts?: MovementResult[];
}

const where = (loc: number) => LOCATION_NAME[loc] ?? `la ubicación ${loc}`;

/**
 * ÚNICO punto que modifica stock y costo promedio. Siempre recibe la transacción
 * del llamador para que el movimiento y el cambio de stock sean atómicos.
 *
 * Existencias por ubicación (mejora n.° 23): products.stock es el total y product_stocks lo
 * reparte entre la Bodega principal y la Sucursal. Cada movimiento cambia ambos; un trigger
 * diferido de la BD verifica al confirmar que la suma por ubicación sea igual al total.
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
    const [rows, stocks] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: sorted } },
        select: { id: true, sku: true, name: true, stock: true, avgCost: true },
      }) as Promise<{ id: string; sku: string; name: string; stock: number; avgCost: { toString(): string } }[]>,
      tx.productStock.findMany({
        where: { productId: { in: sorted } },
        select: { productId: true, locationId: true, quantity: true },
      }) as Promise<{ productId: string; locationId: number; quantity: number }[]>,
    ]);

    const map = new Map<string, LockedProduct>();
    for (const r of rows) map.set(r.id, { ...r, avgCost: new Decimal(r.avgCost.toString()), byLocation: new Map() });
    for (const s of stocks) map.get(s.productId)?.byLocation.set(s.locationId, s.quantity);
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
    return this.apply(tx, p, InventoryMovementType.ENTRY, input.quantity, unitCost, stockAfter, newAvg, input, input.quantity);
  }

  async registerExit(
    tx: Prisma.TransactionClient,
    input: { productId: string; quantity: number } & MovementContext,
  ): Promise<MovementResult> {
    const [res] = await this.registerExits(tx, [{ productId: input.productId, quantity: input.quantity }], input);
    return res;
  }

  /**
   * Salida de varios productos a la vez (ventas, consumo de producción). Valida TODOS antes de
   * modificar nada y reporta cada faltante con el índice de su línea. El costo de salida es el
   * promedio vigente.
   *
   * `from`: ubicaciones de donde puede salir, en orden de preferencia (una venta toma primero
   * de la sucursal y luego de la bodega). Sin `from`, solo de `ctx.locationId` (o la bodega).
   * Si una línea se reparte entre dos ubicaciones se registra un movimiento por ubicación.
   */
  async registerExits(
    tx: Prisma.TransactionClient,
    lines: { productId: string; quantity: number }[],
    ctx: MovementContext,
    fieldPrefix = 'items',
    from?: number[],
  ): Promise<MovementResult[]> {
    lines.forEach((l) => this.assertQuantity(l.quantity));
    const sources = from?.length ? from : [ctx.locationId ?? MAIN_WAREHOUSE_ID];
    const locked = await this.lockProducts(
      tx,
      lines.map((l) => l.productId),
    );

    // Disponibilidad que queda en cada ubicación mientras se validan las líneas (un producto
    // podría venir en más de una línea).
    const left = new Map<string, Map<number, number>>();
    const errors: { field: string; message: string }[] = [];
    lines.forEach((l, i) => {
      const p = locked.get(l.productId);
      if (!p) {
        errors.push({ field: `${fieldPrefix}[${i}].productId`, message: 'El producto no existe' });
        return;
      }
      const avail = left.get(p.id) ?? new Map(sources.map((loc) => [loc, p.byLocation.get(loc) ?? 0]));
      left.set(p.id, avail);
      const total = sources.reduce((t, loc) => t + (avail.get(loc) ?? 0), 0);
      if (total < l.quantity) {
        errors.push({
          field: `${fieldPrefix}[${i}].quantity`,
          message: `Stock insuficiente de ${p.sku}${sources.length === 1 ? ` en ${where(sources[0])}` : ''}: disponible ${total}, solicitado ${l.quantity}`,
        });
        return;
      }
      let rest = l.quantity;
      for (const loc of sources) {
        const take = Math.min(rest, avail.get(loc) ?? 0);
        avail.set(loc, (avail.get(loc) ?? 0) - take);
        rest -= take;
      }
    });
    if (errors.length) {
      throw new ConflictException({ message: 'Stock insuficiente para completar la operación', errors });
    }

    const results: MovementResult[] = [];
    for (const l of lines) {
      const p = locked.get(l.productId)!;
      const parts: MovementResult[] = [];
      let rest = l.quantity;
      for (const loc of sources) {
        const take = Math.min(rest, p.byLocation.get(loc) ?? 0);
        if (take <= 0) continue;
        parts.push(
          await this.apply(tx, p, InventoryMovementType.EXIT, take, p.avgCost, p.stock - take, p.avgCost, { ...ctx, locationId: loc }, -take),
        );
        rest -= take;
        if (rest === 0) break;
      }
      results.push(parts.length > 1 ? { ...parts[0], parts } : parts[0]);
    }
    return results;
  }

  /**
   * Ajuste por conteo físico en una ubicación: `newStock` es lo contado ALLÍ (la bodega si no
   * se indica). El total cambia en la diferencia; el costo promedio no cambia.
   */
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
    const loc = input.locationId ?? MAIN_WAREHOUSE_ID;
    const p = await this.lockOne(tx, input.productId);
    const here = p.byLocation.get(loc) ?? 0;
    const delta = input.newStock - here;
    if (delta === 0) {
      throw new BadRequestException({
        message: 'El ajuste no cambia el stock',
        errors: [{ field: 'newStock', message: `El stock en ${where(loc)} ya es ${here}` }],
      });
    }
    return this.apply(tx, p, InventoryMovementType.ADJUSTMENT, Math.abs(delta), p.avgCost, p.stock + delta, p.avgCost, { ...input, locationId: loc }, delta);
  }

  /**
   * Traslado entre ubicaciones: por cada línea, salida en el origen y entrada en el destino al
   * mismo costo promedio. El stock total y el costo promedio no cambian.
   */
  async transfer(
    tx: Prisma.TransactionClient,
    input: { fromLocationId: number; toLocationId: number; lines: { productId: string; quantity: number }[] } & Omit<MovementContext, 'locationId'>,
  ): Promise<{ exits: MovementResult[]; entries: MovementResult[] }> {
    const { fromLocationId, toLocationId, lines, ...ctx } = input;
    if (fromLocationId === toLocationId) {
      throw new BadRequestException({ message: 'Traslado inválido', errors: [{ field: 'toLocationId', message: 'El destino debe ser distinto del origen' }] });
    }
    const exits = await this.registerExits(tx, lines, { ...ctx, locationId: fromLocationId }, 'items', [fromLocationId]);
    const entries: MovementResult[] = [];
    for (let i = 0; i < lines.length; i++) {
      entries.push(
        await this.registerEntry(tx, {
          ...ctx,
          productId: lines[i].productId,
          quantity: lines[i].quantity,
          unitCost: exits[i].movement.unitCost.toString(),
          locationId: toLocationId,
        }),
      );
    }
    return { exits, entries };
  }

  // ───────────────────────── internos ─────────────────────────

  private async lockOne(tx: Prisma.TransactionClient, productId: string): Promise<LockedProduct> {
    const p = (await this.lockProducts(tx, [productId])).get(productId);
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  /** Registra el movimiento y actualiza el total y la existencia de la ubicación (`delta` con signo). */
  private async apply(
    tx: Prisma.TransactionClient,
    p: LockedProduct,
    type: InventoryMovementType,
    quantity: number,
    unitCost: Decimal,
    stockAfter: number,
    newAvg: Decimal,
    ctx: MovementContext,
    delta: number,
  ): Promise<MovementResult> {
    const locationId = ctx.locationId ?? MAIN_WAREHOUSE_ID;
    const stockBefore = p.stock;
    await tx.product.update({
      where: { id: p.id },
      data: { stock: stockAfter, avgCost: fixed4(newAvg), version: { increment: 1 } },
    });
    // Con el producto bloqueado nadie más crea su fila de esta ubicación. (No se usa upsert:
    // PostgreSQL valida el CHECK quantity >= 0 sobre la fila propuesta aunque termine actualizando.)
    if (p.byLocation.has(locationId)) {
      await tx.productStock.update({
        where: { productId_locationId: { productId: p.id, locationId } },
        data: { quantity: { increment: delta } },
      });
    } else {
      await tx.productStock.create({ data: { productId: p.id, locationId, quantity: delta } });
    }
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: p.id,
        type,
        quantity,
        unitCost: fixed4(unitCost),
        stockBefore,
        stockAfter,
        reference: ctx.reference ?? null,
        note: ctx.note ?? null,
        userId: ctx.userId,
        supplierId: ctx.supplierId ?? null,
        saleId: ctx.saleId ?? null,
        purchaseReceiptItemId: ctx.purchaseReceiptItemId ?? null,
        productionOrderId: ctx.productionOrderId ?? null,
        productionLotId: ctx.productionLotId ?? null,
        transferId: ctx.transferId ?? null,
        locationId,
      },
    });
    // El producto bloqueado refleja el nuevo estado (una salida puede tener más de una parte).
    p.stock = stockAfter;
    p.avgCost = newAvg;
    p.byLocation.set(locationId, (p.byLocation.get(locationId) ?? 0) + delta);
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
