import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { buildPagination } from '../common/utils/pagination';
import { InventoryMovementType } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilterProductDto } from '../products/dto/product.dto';
import { ProductsService } from '../products/products.service';
import { CreateMovementDto, FilterMovementDto } from './dto/inventory.dto';
import { MovementResult, StockService } from './stock.service';

const MOVEMENT_INCLUDE = {
  product: { select: { id: true, sku: true, name: true } },
  user: { select: { id: true, username: true } },
  supplier: { select: { id: true, name: true } },
} as const;

interface MovementRow {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  unitCost: { toString(): string };
  stockBefore: number;
  stockAfter: number;
  reference: string | null;
  note: string | null;
  sourceEntity: string | null;
  sourceId: string | null;
  createdAt: Date;
  product?: { id: string; sku: string; name: string };
  user?: { id: string; username: string };
  supplier?: { id: string; name: string } | null;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly products: ProductsService,
    private readonly audit: AuditService,
  ) {}

  /** Existencias actuales (mismos filtros que /products) con valor de inventario y resumen global. */
  async overview(filter: FilterProductDto) {
    const [list, summary] = await Promise.all([this.products.findAll(filter), this.summary()]);
    return {
      data: list.data.map((p) => ({
        ...p,
        stockValue: Math.round(p.stock * p.avgCost * 100) / 100,
      })),
      pagination: list.pagination,
      summary,
    };
  }

  async movements(filter: FilterMovementDto) {
    const { page, limit } = filter;
    const where: Prisma.InventoryMovementWhereInput = {
      ...(filter.productId && { productId: filter.productId }),
      ...(filter.type && { type: filter.type }),
      ...(filter.supplierId && { supplierId: filter.supplierId }),
      ...(filter.userId && { userId: filter.userId }),
      ...(dateRange(filter.from, filter.to) && { createdAt: dateRange(filter.from, filter.to) }),
      ...(filter.search && {
        OR: [
          { reference: { contains: filter.search, mode: 'insensitive' as const } },
          { note: { contains: filter.search, mode: 'insensitive' as const } },
          { product: { sku: { contains: filter.search, mode: 'insensitive' as const } } },
          { product: { name: { contains: filter.search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: (rows as MovementRow[]).map((m) => this.toDto(m)),
      pagination: buildPagination(page, limit, total),
    };
  }

  /** Registro manual: entrada (compra), salida (merma/uso interno) o ajuste por conteo físico. */
  async createMovement(dto: CreateMovementDto, actor: AuthUser, ip?: string) {
    this.validateByType(dto);

    const supplierId = dto.type === InventoryMovementType.ENTRY ? dto.supplierId : undefined;
    if (supplierId) {
      const s = await this.prisma.supplier.findUnique({ where: { id: supplierId }, select: { isActive: true } });
      if (!s) throw this.fieldError('supplierId', 'El proveedor no existe');
      if (!s.isActive) throw this.fieldError('supplierId', 'El proveedor está inactivo');
    }

    const ctx = {
      userId: actor.id,
      supplierId,
      reference: dto.reference || null,
      note: dto.note || null,
    };

    const result: MovementResult = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        switch (dto.type) {
          case InventoryMovementType.ENTRY:
            return this.stock.registerEntry(tx, {
              productId: dto.productId,
              quantity: dto.quantity!,
              unitCost: dto.unitCost!,
              ...ctx,
            });
          case InventoryMovementType.EXIT:
            return this.stock.registerExit(tx, { productId: dto.productId, quantity: dto.quantity!, ...ctx });
          default:
            return this.stock.registerAdjustment(tx, {
              productId: dto.productId,
              newStock: dto.newStock!,
              ...ctx,
            });
        }
      },
      { maxWait: 5_000, timeout: 15_000 },
    );

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'inventory',
      action: dto.type,
      entity: 'InventoryMovement',
      entityId: result.movement.id,
      description: `${dto.type} de ${result.movement.quantity} u. de ${result.product.sku} (stock ${result.movement.stockBefore} → ${result.movement.stockAfter})`,
      ip,
    });

    return {
      movement: this.toDto(result.movement as MovementRow),
      product: {
        id: result.product.id,
        sku: result.product.sku,
        name: result.product.name,
        stock: result.product.stock,
        avgCost: decimalToNumber(result.product.avgCost),
      },
    };
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Resumen sobre productos activos; la comparación stock ≤ mínimo se hace en SQL. */
  private async summary() {
    const rows = (await this.prisma.$queryRaw`
      SELECT COUNT(*)::int AS "totalProducts",
             COUNT(*) FILTER (WHERE stock <= min_stock)::int AS "lowStockProducts",
             COUNT(*) FILTER (WHERE stock = 0)::int AS "outOfStockProducts",
             COALESCE(SUM(stock * avg_cost), 0)::text AS "stockValue"
      FROM products WHERE is_active = true`) as {
      totalProducts: number;
      lowStockProducts: number;
      outOfStockProducts: number;
      stockValue: string;
    }[];
    const r = rows[0];
    return {
      totalProducts: r?.totalProducts ?? 0,
      lowStockProducts: r?.lowStockProducts ?? 0,
      outOfStockProducts: r?.outOfStockProducts ?? 0,
      stockValue: Math.round(Number(r?.stockValue ?? 0) * 100) / 100,
    };
  }

  /** Rechaza campos que no corresponden al tipo y exige nota donde corresponde. */
  private validateByType(dto: CreateMovementDto) {
    const errors: { field: string; message: string }[] = [];
    const t = dto.type;
    if (t !== InventoryMovementType.ENTRY) {
      if (dto.unitCost !== undefined) errors.push({ field: 'unitCost', message: 'El costo solo aplica a entradas; la salida usa el costo promedio' });
      if (dto.supplierId !== undefined) errors.push({ field: 'supplierId', message: 'El proveedor solo aplica a entradas' });
    }
    if (t !== InventoryMovementType.ADJUSTMENT && dto.newStock !== undefined) {
      errors.push({ field: 'newStock', message: 'El stock contado solo aplica a ajustes' });
    }
    if (t === InventoryMovementType.ADJUSTMENT && dto.quantity !== undefined) {
      errors.push({ field: 'quantity', message: 'En un ajuste indique el stock contado (newStock), no la cantidad' });
    }
    if (t !== InventoryMovementType.ENTRY && (dto.note ?? '').length < 5) {
      errors.push({ field: 'note', message: 'Indique el motivo (mínimo 5 caracteres)' });
    }
    if (errors.length) throw new BadRequestException({ message: 'Movimiento inválido', errors });
  }

  private fieldError(field: string, message: string) {
    return new BadRequestException({ message: 'Movimiento inválido', errors: [{ field, message }] });
  }

  private toDto(m: MovementRow) {
    return {
      id: m.id,
      productId: m.productId,
      product: m.product,
      type: m.type,
      quantity: m.quantity,
      unitCost: decimalToNumber(m.unitCost),
      stockBefore: m.stockBefore,
      stockAfter: m.stockAfter,
      reference: m.reference ?? null,
      note: m.note ?? null,
      supplier: m.supplier ?? null,
      user: m.user,
      sourceEntity: m.sourceEntity ?? null,
      sourceId: m.sourceId ?? null,
      createdAt: m.createdAt,
    };
  }
}

