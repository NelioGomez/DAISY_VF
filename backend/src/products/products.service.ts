import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { SortOrder } from '../common/dto/sort-order.enum';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { toCsv } from '../common/utils/csv';
import { decimalToNumber } from '../common/utils/decimal';
import { setPriceContext } from '../common/utils/db-context';
import { buildPagination } from '../common/utils/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../common/utils/prisma-errors';
import { addDays } from '../common/utils/dates';
import { Prisma, PurchaseStatus, UserRole } from '../generated/prisma/client';
import { MOVEMENT_ORIGIN_INCLUDE, movementOrigin } from '../inventory/movement-origin';
import { PrismaService } from '../prisma/prisma.service';
import { ts } from '../reports/report-sql';
import {
  CreateProductDto,
  FilterProductDto,
  ProductSortField,
  UpdateProductDto,
  SetProductPriceDto,
} from './dto/product.dto';

const EXPORT_MAX_ROWS = 50_000;

const PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  description: true,
  categoryId: true,
  brandId: true,
  avgCost: true,
  salePrice: true,
  stock: true,
  minStock: true,
  maxStock: true,
  restockPostponedUntil: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  avgCost: { toString(): string };
  salePrice: { toString(): string };
  stock: number;
  minStock: number;
  maxStock?: number | null;
  restockPostponedUntil?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: FilterProductDto) {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SELECT,
        orderBy: this.buildOrderBy(filter),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: (rows as ProductRow[]).map((p) => this.toDto(p)),
      pagination: buildPagination(page, limit, total),
    };
  }

  async findOne(id: string) {
    const product = (await this.prisma.product.findUnique({
      where: { id },
      select: PRODUCT_SELECT,
    })) as ProductRow | null;
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.toDto(product);
  }

  /** CSV con los mismos filtros que el listado (sin paginar, hasta 50.000 filas). */
  async exportCsv(filter: FilterProductDto, actor: AuthUser, ip?: string): Promise<string> {
    const rows = (await this.prisma.product.findMany({
      where: this.buildWhere(filter),
      select: PRODUCT_SELECT,
      orderBy: this.buildOrderBy(filter),
      take: EXPORT_MAX_ROWS,
    })) as ProductRow[];

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'products',
      action: 'EXPORT',
      entity: 'Product',
      description: `Exportación de ${rows.length} productos a CSV`,
      ip,
    });

    return toCsv(
      rows.map((p) => this.toDto(p)),
      [
        { header: 'SKU', value: (p) => p.sku },
        { header: 'Nombre', value: (p) => p.name },
        { header: 'Marca', value: (p) => p.brand?.name },
        { header: 'Categoría', value: (p) => p.category?.name },
        { header: 'Costo promedio', value: (p) => p.avgCost },
        { header: 'Precio de venta', value: (p) => p.salePrice },
        { header: 'Stock', value: (p) => p.stock },
        { header: 'Stock mínimo', value: (p) => p.minStock },
        { header: 'Stock crítico', value: (p) => p.lowStock },
        { header: 'Activo', value: (p) => p.isActive },
        { header: 'Fecha de creación', value: (p) => p.createdAt },
      ],
    );
  }

  async create(dto: CreateProductDto, actor: AuthUser, ip?: string) {
    await this.assertSkuFree(dto.sku);
    await this.assertRelations(dto.categoryId, dto.brandId);
    this.assertStockLimits(dto.minStock ?? 0, dto.maxStock ?? null);
    if (dto.salePrice !== undefined && dto.salePrice > 0) this.assertCanPrice(actor);

    try {
      // Stock y costo promedio nacen en 0; solo cambian con movimientos de inventario.
      // El precio (si lo fija alguien autorizado) abre el historial mediante el trigger de la BD.
      const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await setPriceContext(tx, actor.id, 'Precio inicial');
        return tx.product.create({
          data: {
            sku: dto.sku,
            name: dto.name,
            description: dto.description,
            categoryId: dto.categoryId ?? null,
            brandId: dto.brandId ?? null,
            salePrice: dto.salePrice ?? 0,
            minStock: dto.minStock ?? 0,
            maxStock: dto.maxStock ?? null,
            isActive: dto.isActive ?? true,
          },
          select: PRODUCT_SELECT,
        });
      })) as ProductRow;
      await this.log(actor, 'CREATE', created.id, `Producto ${created.sku} creado`, ip);
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) await this.assertSkuFree(dto.sku);
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto, actor: AuthUser, ip?: string) {
    const existing = await this.findOne(id);
    if (dto.sku && dto.sku !== existing.sku) await this.assertSkuFree(dto.sku, id);
    await this.assertRelations(dto.categoryId, dto.brandId);
    if (dto.minStock !== undefined || dto.maxStock !== undefined) {
      this.assertStockLimits(dto.minStock ?? existing.minStock, dto.maxStock !== undefined ? dto.maxStock : existing.maxStock);
    }

    const priceChanges = dto.salePrice !== undefined && dto.salePrice !== existing.salePrice;
    if (priceChanges) this.assertCanPrice(actor);

    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (priceChanges) await setPriceContext(tx, actor.id, dto.priceReason || 'Cambio de precio');
      return tx.product.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.brandId !== undefined && { brandId: dto.brandId }),
          ...(priceChanges && { salePrice: dto.salePrice }),
          ...(dto.minStock !== undefined && { minStock: dto.minStock }),
          ...(dto.maxStock !== undefined && { maxStock: dto.maxStock }),
        },
        select: PRODUCT_SELECT,
      });
    })) as ProductRow;

    const detail = priceChanges ? ` (precio C$ ${existing.salePrice} → C$ ${dto.salePrice})` : '';
    await this.log(actor, 'UPDATE', id, `Producto ${updated.sku} modificado${detail}`, ip);
    return this.toDto(updated);
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    const updated = (await this.prisma.product.update({
      where: { id },
      data: { isActive },
      select: PRODUCT_SELECT,
    })) as ProductRow;
    await this.log(
      actor,
      isActive ? 'ACTIVATE' : 'DEACTIVATE',
      id,
      `Producto ${updated.sku} ${isActive ? 'activado' : 'desactivado'}`,
      ip,
    );
    return this.toDto(updated);
  }

  /** Solo se elimina físicamente un producto sin movimientos, cotizaciones ni ventas. */
  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        sku: true,
        _count: { select: { movements: true, saleItems: true, quotationItems: true } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const refs =
      product._count.movements + product._count.saleItems + product._count.quotationItems;
    if (refs > 0) throw this.inUse();

    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw this.inUse();
      throw error;
    }
    await this.log(actor, 'DELETE', id, `Producto ${product.sku} eliminado`, ip);
  }

  /** Fija el precio comercial; el trigger de la BD cierra el vigente y abre uno nuevo en el historial. */
  async setPrice(id: string, dto: SetProductPriceDto, actor: AuthUser, ip?: string) {
    const existing = await this.findOne(id);
    if (dto.salePrice === existing.salePrice) {
      throw new BadRequestException({
        message: 'El precio no cambió',
        errors: [{ field: 'salePrice', message: `El precio vigente ya es C$ ${existing.salePrice.toFixed(2)}` }],
      });
    }
    const updated = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await setPriceContext(tx, actor.id, dto.reason || 'Cambio de precio');
      return tx.product.update({ where: { id }, data: { salePrice: dto.salePrice }, select: PRODUCT_SELECT });
    })) as ProductRow;
    await this.log(
      actor,
      'PRICE_CHANGE',
      id,
      `Precio de ${updated.sku}: C$ ${existing.salePrice.toFixed(2)} → C$ ${dto.salePrice.toFixed(2)}${dto.reason ? ` (${dto.reason})` : ''}`,
      ip,
    );
    return this.toDto(updated);
  }

  /**
   * Ficha detallada (mejora n.° 3): todo lo del producto en una sola consulta —datos maestros,
   * existencias, rotación, últimos movimientos, ventas recientes, proveedores, compras en camino e
   * historial de precios. Cada sección llega en null si el rol no puede verla (igual que el dashboard).
   */
  async detail(id: string, actor: AuthUser) {
    const product = await this.findOne(id);
    const can = (p: string) => actor.role === UserRole.ADMIN || actor.permissions.includes(p);
    const now = new Date();
    const since30 = addDays(now, -30);
    const since90 = addDays(now, -90);

    const [stats, movements, sales, suppliers, incoming, prices] = await Promise.all([
      can('sales:read')
        ? (this.prisma.$queryRaw(Prisma.sql`
            SELECT COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${ts(since30)}), 0)::int AS units30,
                   COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${ts(since90)}), 0)::int AS units90,
                   COALESCE(SUM(si.subtotal) FILTER (WHERE s.sold_at >= ${ts(since90)}), 0)::text AS revenue90,
                   COALESCE(SUM((si.unit_price - si.unit_cost) * si.quantity) FILTER (WHERE s.sold_at >= ${ts(since90)}), 0)::text AS margin90,
                   MAX(s.sold_at) AS last_sale
            FROM sale_items si JOIN sales s ON s.id = si.sale_id
            WHERE si.product_id = ${id}::uuid AND s.status = 'ACTIVE'`) as Promise<Record<string, unknown>[]>)
        : Promise.resolve(null),
      can('inventory:read')
        ? this.prisma.inventoryMovement.findMany({
            where: { productId: id },
            include: { user: { select: { username: true } }, supplier: { select: { name: true } }, ...MOVEMENT_ORIGIN_INCLUDE },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 20,
          })
        : Promise.resolve(null),
      can('sales:read')
        ? this.prisma.saleItem.findMany({
            where: { productId: id },
            select: {
              quantity: true,
              unitPrice: true,
              subtotal: true,
              sale: { select: { id: true, invoiceNumber: true, soldAt: true, status: true, customer: { select: { id: true, name: true } } } },
            },
            orderBy: { sale: { soldAt: 'desc' } },
            take: 10,
          })
        : Promise.resolve(null),
      can('suppliers:read') || can('purchases:read')
        ? this.prisma.productSupplier.findMany({
            where: { productId: id },
            include: { supplier: { select: { id: true, name: true, country: true, isActive: true } } },
            orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }],
          })
        : Promise.resolve(null),
      can('purchases:read')
        ? this.prisma.purchaseItem.findMany({
            where: { productId: id, purchase: { status: { in: [PurchaseStatus.ORDERED, PurchaseStatus.PARTIALLY_RECEIVED] } } },
            select: {
              quantity: true,
              receivedQuantity: true,
              purchase: { select: { id: true, code: true, expectedAt: true, supplier: { select: { name: true } } } },
            },
          })
        : Promise.resolve(null),
      can('prices:read') ? this.priceHistory(id).then((r) => r.slice(0, 10)) : Promise.resolve(null),
    ]);

    const s = stats?.[0];
    const units90 = s ? Number(s.units90 ?? 0) : null;
    const daily = units90 !== null ? units90 / 90 : null;
    const daysOfCover = daily && daily > 0 ? Math.floor(product.stock / daily) : null;
    const pending = (incoming ?? []).map((i) => ({
      purchaseId: i.purchase.id,
      code: i.purchase.code,
      supplier: i.purchase.supplier.name,
      expectedAt: i.purchase.expectedAt,
      pending: i.quantity - i.receivedQuantity,
    }));

    return {
      product,
      availability: product.stock <= 0 ? 'OUT_OF_STOCK' : product.stock <= product.minStock ? 'LOW' : 'AVAILABLE',
      stats: s
        ? {
            unitsLast30Days: Number(s.units30 ?? 0),
            unitsLast90Days: units90,
            revenueLast90Days: Number(s.revenue90 ?? 0),
            marginLast90Days: Number(s.margin90 ?? 0),
            lastSaleAt: (s.last_sale as Date | null) ?? null,
            /** Días que alcanza el stock al ritmo de los últimos 90 días (null si no se vendió). */
            daysOfCover,
            /** Rotación: ALTA (≤ 30 días de stock), MEDIA (≤ 90), BAJA (> 90), SIN_MOVIMIENTO (sin ventas en 90 días). */
            rotation: units90 === 0 ? 'SIN_MOVIMIENTO' : daysOfCover === null ? 'SIN_MOVIMIENTO' : daysOfCover <= 30 ? 'ALTA' : daysOfCover <= 90 ? 'MEDIA' : 'BAJA',
          }
        : null,
      incoming: incoming ? { units: pending.reduce((n, p) => n + p.pending, 0), purchases: pending } : null,
      movements: movements
        ? movements.map((m) => ({
            id: m.id,
            type: m.type,
            quantity: m.quantity,
            unitCost: decimalToNumber(m.unitCost),
            stockBefore: m.stockBefore,
            stockAfter: m.stockAfter,
            reference: m.reference,
            note: m.note,
            user: m.user?.username ?? null,
            supplier: m.supplier?.name ?? null,
            locationId: m.locationId,
            origin: movementOrigin(m),
            createdAt: m.createdAt,
          }))
        : null,
      sales: sales
        ? sales.map((i) => ({
            saleId: i.sale.id,
            invoiceNumber: i.sale.invoiceNumber,
            soldAt: i.sale.soldAt,
            status: i.sale.status,
            customer: i.sale.customer,
            quantity: i.quantity,
            unitPrice: decimalToNumber(i.unitPrice),
            subtotal: decimalToNumber(i.subtotal),
          }))
        : null,
      suppliers: suppliers
        ? suppliers.map((ps) => ({
            supplier: ps.supplier,
            supplierSku: ps.supplierSku,
            lastCost: ps.lastCost === null ? null : decimalToNumber(ps.lastCost),
            currency: ps.currency,
            leadTimeDays: ps.leadTimeDays,
            isPreferred: ps.isPreferred,
            updatedAt: ps.updatedAt,
          }))
        : null,
      prices,
    };
  }

  /** Historial de precios del producto, del más reciente al más antiguo. */
  async priceHistory(id: string) {
    await this.findOne(id);
    const rows = await this.prisma.productPrice.findMany({
      where: { productId: id },
      orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        price: true,
        validFrom: true,
        validTo: true,
        reason: true,
        changedBy: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((r) => ({ ...r, price: decimalToNumber(r.price) }));
  }

  // ───────────────────────── helpers ─────────────────────────

  /** El precio comercial lo fijan Administración y Gerencia (permiso prices:write). */
  private assertCanPrice(actor: AuthUser) {
    if (!actor.permissions.includes('prices:write')) {
      throw new ForbiddenException({
        message: 'Su rol no puede fijar precios',
        errors: [{ field: 'salePrice', message: 'El precio comercial lo establece Administración o Gerencia' }],
      });
    }
  }

  /** Mismo criterio que el CHECK chk_products_max_stock: el tope no puede quedar debajo del mínimo. */
  private assertStockLimits(minStock: number, maxStock: number | null | undefined) {
    if (maxStock !== null && maxStock !== undefined && maxStock < minStock) {
      throw new BadRequestException({
        message: 'Datos de producto inválidos',
        errors: [{ field: 'maxStock', message: `El stock máximo (${maxStock}) no puede ser menor que el mínimo (${minStock})` }],
      });
    }
  }

  private inUse() {
    return new ConflictException(
      'El producto tiene movimientos, cotizaciones o ventas y no puede eliminarse. Desactívelo en su lugar.',
    );
  }

  private buildWhere(f: FilterProductDto) {
    // Comparación columna contra columna (stock <= stock mínimo) con field references.
    const minStockRef = this.prisma.product.fields.minStock;
    return {
      ...(f.isActive !== undefined && { isActive: f.isActive }),
      ...(f.categoryId && { categoryId: f.categoryId }),
      ...(f.brandId && { brandId: f.brandId }),
      ...(f.lowStock === true && { stock: { lte: minStockRef } }),
      ...(f.lowStock === false && { stock: { gt: minStockRef } }),
      ...(f.search && {
        OR: [
          { sku: { contains: f.search, mode: 'insensitive' as const } },
          { name: { contains: f.search, mode: 'insensitive' as const } },
          { description: { contains: f.search, mode: 'insensitive' as const } },
        ],
      }),
    };
  }

  private buildOrderBy(f: FilterProductDto) {
    const dir: 'asc' | 'desc' = f.sortOrder === SortOrder.DESC ? 'desc' : 'asc';
    switch (f.sortBy) {
      case ProductSortField.SKU:
        return { sku: dir };
      case ProductSortField.SALE_PRICE:
        return { salePrice: dir };
      case ProductSortField.STOCK:
        return { stock: dir };
      case ProductSortField.CREATED_AT:
        return { createdAt: dir };
      default:
        return { name: dir };
    }
  }

  private async assertSkuFree(sku: string, excludeId?: string) {
    const clash = await this.prisma.product.findFirst({
      where: { sku, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        message: 'No fue posible registrar el producto',
        errors: [{ field: 'sku', message: 'El SKU ya existe' }],
      });
    }
  }

  /** La categoría y la marca deben existir y estar activas (null = quitar). */
  private async assertRelations(categoryId?: string | null, brandId?: string | null) {
    const errors: { field: string; message: string }[] = [];

    if (categoryId) {
      const c = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { isActive: true },
      });
      if (!c) errors.push({ field: 'categoryId', message: 'La categoría no existe' });
      else if (!c.isActive) errors.push({ field: 'categoryId', message: 'La categoría está inactiva' });
    }
    if (brandId) {
      const b = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { isActive: true },
      });
      if (!b) errors.push({ field: 'brandId', message: 'La marca no existe' });
      else if (!b.isActive) errors.push({ field: 'brandId', message: 'La marca está inactiva' });
    }

    if (errors.length) {
      throw new BadRequestException({ message: 'Datos de producto inválidos', errors });
    }
  }

  private toDto(p: ProductRow) {
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      category: p.category,
      brandId: p.brandId,
      brand: p.brand,
      avgCost: decimalToNumber(p.avgCost),
      salePrice: decimalToNumber(p.salePrice),
      stock: p.stock,
      minStock: p.minStock,
      maxStock: p.maxStock ?? null,
      restockPostponedUntil: p.restockPostponedUntil ?? null,
      lowStock: p.stock <= p.minStock,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private log(actor: AuthUser, action: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'products',
      action,
      entity: 'Product',
      entityId,
      description,
      ip,
    });
  }
}