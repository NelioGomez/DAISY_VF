import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { LOCATION_NAME, MAIN_WAREHOUSE_ID } from '../common/constants/locations';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { TX_OPTIONS } from '../common/utils/locks';
import { buildPagination } from '../common/utils/pagination';
import { addDays } from '../common/utils/dates';
import { ts } from '../reports/report-sql';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { Currency, InventoryMovementType } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilterProductDto } from '../products/dto/product.dto';
import { ProductsService } from '../products/products.service';
import { CreateMovementDto, CreateTransferDto, FilterMovementDto, FilterTransferDto } from './dto/inventory.dto';
import { MOVEMENT_ORIGIN_INCLUDE, movementOrigin, type MovementOriginRow } from './movement-origin';
import { rememberSupplierCost } from './product-suppliers';
import { daysOfCover, ROTATION_WINDOW_DAYS, rotationOf, type Rotation } from './rotation';
import { MovementResult, StockService } from './stock.service';

const MOVEMENT_INCLUDE = {
  product: { select: { id: true, sku: true, name: true } },
  user: { select: { id: true, username: true } },
  supplier: { select: { id: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
  // Documento de origen (trazabilidad navegable): venta, recepción, producción o traslado.
  ...MOVEMENT_ORIGIN_INCLUDE,
} as const;

const TRANSFER_INCLUDE = {
  fromLocation: { select: { id: true, code: true, name: true } },
  toLocation: { select: { id: true, code: true, name: true } },
  user: { select: { username: true, firstName: true, lastName: true } },
  // Una línea por producto: la entrada en el destino (la salida en el origen es su espejo).
  movements: {
    where: { type: InventoryMovementType.ENTRY },
    select: { id: true, quantity: true, unitCost: true, product: { select: { id: true, sku: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type TransferRow = Prisma.StockTransferGetPayload<{ include: typeof TRANSFER_INCLUDE }>;

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
  saleId: string | null;
  purchaseReceiptItemId: string | null;
  locationId: number;
  createdAt: Date;
  location?: { id: number; code: string; name: string };
  product?: { id: string; sku: string; name: string };
  user?: { id: string; username: string };
  supplier?: { id: string; name: string } | null;
  sale?: MovementOriginRow['sale'];
  purchaseReceiptItem?: MovementOriginRow['purchaseReceiptItem'];
  transfer?: MovementOriginRow['transfer'];
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly products: ProductsService,
    private readonly audit: AuditService,
    private readonly sequence: DocumentSequenceService,
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
      ...(filter.locationId && { locationId: filter.locationId }),
      ...(filter.userId && { userId: filter.userId }),
      ...(dateRange(filter.from, filter.to) && { createdAt: dateRange(filter.from, filter.to) }),
      ...(filter.search && {
        OR: [
          { reference: { contains: filter.search, mode: 'insensitive' as const } },
          { note: { contains: filter.search, mode: 'insensitive' as const } },
          { product: { sku: { contains: filter.search, mode: 'insensitive' as const } } },
          { product: { name: { contains: filter.search, mode: 'insensitive' as const } } },
          // Por el código del documento de origen: OP-…, LOT-…, TR-…, FAC-…
          { productionOrder: { code: { contains: filter.search, mode: 'insensitive' as const } } },
          { productionLot: { code: { contains: filter.search, mode: 'insensitive' as const } } },
          { transfer: { code: { contains: filter.search, mode: 'insensitive' as const } } },
          { sale: { invoiceNumber: { contains: filter.search, mode: 'insensitive' as const } } },
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

    const locationId = dto.locationId ?? MAIN_WAREHOUSE_ID;
    const ctx = {
      userId: actor.id,
      supplierId,
      reference: dto.reference || null,
      note: dto.note || null,
      locationId,
    };

    const result: MovementResult = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        switch (dto.type) {
          case InventoryMovementType.ENTRY: {
            const res = await this.stock.registerEntry(tx, {
              productId: dto.productId,
              quantity: dto.quantity!,
              unitCost: dto.unitCost!,
              ...ctx,
            });
            // Una entrada manual con proveedor también alimenta el proveedor preferente y su último costo.
            if (supplierId) {
              await rememberSupplierCost(tx, { productId: dto.productId, supplierId, unitCost: dto.unitCost!, currency: Currency.NIO });
            }
            return res;
          }
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
      description: `${dto.type} de ${result.movement.quantity} u. de ${result.product.sku} en ${LOCATION_NAME[locationId]} (stock total ${result.movement.stockBefore} → ${result.movement.stockAfter})`,
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

  // ───────────────────────── Rotación y días de inventario (n.° 11 y 12) ─────────────────────────

  /**
   * Rotación de cada producto activo (n.° 11 y 12). El uso es lo vendido más lo consumido por
   * producción (un componente como la manguera a granel no se vende, se consume), en unidades:
   * Inventario no ve montos de venta. Incluye días de inventario y el valor detenido por grupo.
   */
  async rotation() {
    const now = new Date();
    const since30 = addDays(now, -30);
    const since90 = addDays(now, -ROTATION_WINDOW_DAYS);
    const rows = (await this.prisma.$queryRaw`
      WITH ventas AS (
        SELECT si.product_id,
               COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${ts(since30)}), 0)::int AS u30,
               COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${ts(since90)}), 0)::int AS u90,
               MAX(s.sold_at) AS ultimo
          FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE s.status = 'ACTIVE'
         GROUP BY si.product_id
      ), consumo AS (
        SELECT m.product_id,
               COALESCE(SUM(m.quantity) FILTER (WHERE m.created_at >= ${ts(since30)}), 0)::int AS u30,
               COALESCE(SUM(m.quantity) FILTER (WHERE m.created_at >= ${ts(since90)}), 0)::int AS u90,
               MAX(m.created_at) AS ultimo
          FROM inventory_movements m
         WHERE m.type = 'EXIT' AND m.production_order_id IS NOT NULL
         GROUP BY m.product_id
      )
      SELECT p.id, p.sku, p.name, p.stock, p.min_stock AS "minStock", p.avg_cost::text AS "avgCost",
             c.name AS category, b.name AS brand,
             COALESCE(v.u30, 0)::int AS "sold30", COALESCE(v.u90, 0)::int AS "sold90",
             COALESCE(k.u30, 0)::int AS "consumed30", COALESCE(k.u90, 0)::int AS "consumed90",
             GREATEST(v.ultimo, k.ultimo) AS "lastUse"
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN ventas v ON v.product_id = p.id
        LEFT JOIN consumo k ON k.product_id = p.id
       WHERE p.is_active = true
       ORDER BY p.name`) as {
      id: string;
      sku: string;
      name: string;
      stock: number;
      minStock: number;
      avgCost: string;
      category: string | null;
      brand: string | null;
      sold30: number;
      sold90: number;
      consumed30: number;
      consumed90: number;
      lastUse: Date | null;
    }[];
    const data = rows.map((r) => {
      const stockValue = Math.round(r.stock * Number(r.avgCost) * 100) / 100;
      const used90 = r.sold90 + r.consumed90;
      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        brand: r.brand,
        stock: r.stock,
        minStock: r.minStock,
        stockValue,
        unitsLast30Days: r.sold30 + r.consumed30,
        unitsLast90Days: used90,
        soldLast90Days: r.sold90,
        consumedLast90Days: r.consumed90,
        dailyRate: Math.round((used90 / ROTATION_WINDOW_DAYS) * 100) / 100,
        daysOfCover: daysOfCover(r.stock, used90),
        rotation: rotationOf(r.stock, used90),
        lastUseAt: r.lastUse,
      };
    });
    const classes: Rotation[] = ['ALTA', 'MEDIA', 'BAJA', 'SIN_MOVIMIENTO'];
    const summary = Object.fromEntries(
      classes.map((k) => {
        const list = data.filter((d) => d.rotation === k);
        return [k, { products: list.length, units: list.reduce((t, d) => t + d.stock, 0), value: Math.round(list.reduce((t, d) => t + d.stockValue, 0) * 100) / 100 }];
      }),
    ) as Record<Rotation, { products: number; units: number; value: number }>;
    return { windowDays: ROTATION_WINDOW_DAYS, data, summary };
  }

  // ───────────────────────── Ubicaciones y traslados (n.° 23) ─────────────────────────

  /** Bodega y sucursal con sus existencias y su valor (al costo promedio). */
  async locations() {
    const [locations, totals] = await Promise.all([
      this.prisma.location.findMany({ where: { isActive: true }, orderBy: { id: 'asc' }, select: { id: true, code: true, name: true, type: true } }),
      this.prisma.$queryRaw`
        SELECT ps.location_id AS "locationId",
               COUNT(*) FILTER (WHERE ps.quantity > 0)::int AS "products",
               COALESCE(SUM(ps.quantity), 0)::int AS "units",
               COALESCE(SUM(ps.quantity * p.avg_cost), 0)::text AS "value"
          FROM product_stocks ps JOIN products p ON p.id = ps.product_id
         WHERE p.is_active = true
         GROUP BY ps.location_id` as Promise<{ locationId: number; products: number; units: number; value: string }[]>,
    ]);
    const byId = new Map(totals.map((t) => [Number(t.locationId), t]));
    return locations.map((l) => {
      const t = byId.get(l.id);
      return { ...l, products: t?.products ?? 0, units: t?.units ?? 0, value: Math.round(Number(t?.value ?? 0) * 100) / 100 };
    });
  }

  async transfers(filter: FilterTransferDto) {
    const { page, limit } = filter;
    const where: Prisma.StockTransferWhereInput = filter.search
      ? {
          OR: [
            { code: { contains: filter.search, mode: 'insensitive' } },
            { note: { contains: filter.search, mode: 'insensitive' } },
            { movements: { some: { product: { OR: [{ sku: { contains: filter.search, mode: 'insensitive' } }, { name: { contains: filter.search, mode: 'insensitive' } }] } } } },
          ],
        }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({ where, include: TRANSFER_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { data: rows.map((t) => this.transferDto(t)), pagination: buildPagination(page, limit, total) };
  }

  async transfer(id: string) {
    const t = await this.prisma.stockTransfer.findUnique({ where: { id }, include: TRANSFER_INCLUDE });
    if (!t) throw new NotFoundException('Traslado no encontrado');
    return this.transferDto(t);
  }

  /** Traslado entre la bodega y la sucursal: salida en el origen y entrada en el destino por línea. */
  async createTransfer(dto: CreateTransferDto, actor: AuthUser, ip?: string) {
    if (dto.fromLocationId === dto.toLocationId) throw this.fieldError('toLocationId', 'El destino debe ser distinto del origen');
    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) throw this.fieldError('items', 'Hay productos repetidos: sume las cantidades en una sola línea');
    const inactive = await this.prisma.product.findMany({ where: { id: { in: ids }, isActive: false }, select: { sku: true } });
    if (inactive.length) throw this.fieldError('items', `Productos inactivos: ${inactive.map((p) => p.sku).join(', ')}`);

    const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const code = await this.sequence.next(tx, 'TRANSFER', 'TR');
      const t = await tx.stockTransfer.create({
        data: { code, fromLocationId: dto.fromLocationId, toLocationId: dto.toLocationId, note: dto.note || null, userId: actor.id },
        select: { id: true, code: true },
      });
      const label = `${LOCATION_NAME[dto.fromLocationId]} → ${LOCATION_NAME[dto.toLocationId]}`;
      await this.stock.transfer(tx, {
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        lines: dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        userId: actor.id,
        reference: code,
        note: dto.note ? `Traslado ${label}: ${dto.note}` : `Traslado ${label}`,
        transferId: t.id,
      });
      return t;
    }, TX_OPTIONS);

    const units = dto.items.reduce((n, i) => n + i.quantity, 0);
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'inventory',
      action: 'TRANSFER',
      entity: 'StockTransfer',
      entityId: created.id,
      description: `Traslado ${created.code}: ${units} u. (${dto.items.length} producto(s)) de ${LOCATION_NAME[dto.fromLocationId]} a ${LOCATION_NAME[dto.toLocationId]}`,
      ip,
    });
    return this.transfer(created.id);
  }

  private transferDto(t: TransferRow) {
    const items = t.movements.map((m) => ({ product: m.product, quantity: m.quantity, unitCost: decimalToNumber(m.unitCost) }));
    return {
      id: t.id,
      code: t.code,
      from: t.fromLocation,
      to: t.toLocation,
      note: t.note,
      user: [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || t.user.username,
      createdAt: t.createdAt,
      units: items.reduce((n, i) => n + i.quantity, 0),
      value: Math.round(items.reduce((v, i) => v + i.quantity * i.unitCost, 0) * 100) / 100,
      items,
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
      saleId: m.saleId ?? null,
      purchaseReceiptItemId: m.purchaseReceiptItemId ?? null,
      origin: movementOrigin(m),
      locationId: m.locationId,
      location: m.location ?? { id: m.locationId, code: m.locationId === MAIN_WAREHOUSE_ID ? 'BOD' : 'SUC', name: LOCATION_NAME[m.locationId] ?? '' },
      createdAt: m.createdAt,
    };
  }
}

