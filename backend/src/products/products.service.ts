import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { SortOrder } from '../common/dto/sort-order.enum';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { toCsv } from '../common/utils/csv';
import { decimalToNumber } from '../common/utils/decimal';
import { buildPagination } from '../common/utils/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  FilterProductDto,
  ProductSortField,
  UpdateProductDto,
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

    try {
      // Stock y costo promedio nacen en 0; solo cambian con movimientos de inventario.
      const created = (await this.prisma.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId ?? null,
          brandId: dto.brandId ?? null,
          salePrice: dto.salePrice,
          minStock: dto.minStock ?? 0,
          isActive: dto.isActive ?? true,
        },
        select: PRODUCT_SELECT,
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

    const updated = (await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.brandId !== undefined && { brandId: dto.brandId }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
      },
      select: PRODUCT_SELECT,
    })) as ProductRow;

    await this.log(actor, 'UPDATE', id, `Producto ${updated.sku} modificado`, ip);
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

  // ───────────────────────── helpers ─────────────────────────

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