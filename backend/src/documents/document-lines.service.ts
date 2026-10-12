import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { Decimal, fixed2, money } from '../common/utils/money';

export interface LineInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export interface PreparedLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Decimal;
  subtotal: Decimal;
}

/**
 * Valida y calcula las líneas de cotización/venta: productos existentes y activos,
 * sin duplicados, precio por defecto = precio de venta vigente.
 */
@Injectable()
export class DocumentLinesService {
  async prepare(
    items: LineInput[],
    db: Prisma.TransactionClient,
  ): Promise<PreparedLine[]> {
    const errors: { field: string; message: string }[] = [];
    if (!items?.length) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: [{ field: 'items', message: 'Debe incluir al menos un producto' }],
      });
    }

    const seen = new Set<string>();
    items.forEach((it, i) => {
      if (seen.has(it.productId)) {
        errors.push({ field: `items[${i}].productId`, message: 'Producto repetido: sume las cantidades en una sola línea' });
      }
      seen.add(it.productId);
    });
    if (errors.length) throw new BadRequestException({ message: 'Datos inválidos', errors });

    const products = (await db.product.findMany({
      where: { id: { in: [...seen] } },
      select: { id: true, sku: true, name: true, salePrice: true, isActive: true },
    })) as { id: string; sku: string; name: string; salePrice: { toString(): string }; isActive: boolean }[];
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines = items.map((it, i) => {
      const p = byId.get(it.productId);
      if (!p) {
        errors.push({ field: `items[${i}].productId`, message: 'El producto no existe' });
        return null;
      }
      if (!p.isActive) {
        errors.push({ field: `items[${i}].productId`, message: `El producto ${p.sku} está inactivo` });
        return null;
      }
      const unitPrice = money(it.unitPrice ?? new Decimal(p.salePrice.toString()));
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        quantity: it.quantity,
        unitPrice,
        subtotal: money(unitPrice.times(it.quantity)),
      } satisfies PreparedLine;
    });
    if (errors.length) throw new BadRequestException({ message: 'Datos inválidos', errors });
    return lines as PreparedLine[];
  }
}

export const lineToData = (l: PreparedLine) => ({
  productId: l.productId,
  quantity: l.quantity,
  unitPrice: fixed2(l.unitPrice),
  subtotal: fixed2(l.subtotal),
});