import { Injectable, NotFoundException } from '@nestjs/common';
import { SortOrder } from '../common/dto/sort-order.enum';
import { decimalToNumber } from '../common/utils/decimal';
import { buildPagination } from '../common/utils/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Availability, PublicProductFilterDto, PublicSortField } from './dto/public.dto';

/** Solo lo que un visitante puede ver: nunca costos, stock exacto, proveedores ni movimientos. */
const PUBLIC_SELECT = {
  id: true,
  sku: true,
  name: true,
  description: true,
  salePrice: true,
  stock: true,
  minStock: true,
  unit: true,
  imageUrl: true,
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

interface PublicRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  salePrice: { toString(): string };
  stock: number;
  minStock: number;
  unit?: string;
  imageUrl?: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
}

/** Unidad de medida en palabras (la ficha pública muestra "Precio por unidad/juego/kit…"). */
const UNIT_LABEL: Record<string, string> = {
  UNIT: 'unidad',
  PAIR: 'par',
  SET: 'juego',
  KIT: 'kit',
  BOX: 'caja',
  METER: 'metro',
  LITER: 'litro',
  GALLON: 'galón',
};

export function availabilityOf(stock: number, minStock: number): Availability {
  if (stock <= 0) return Availability.OUT_OF_STOCK;
  return stock <= minStock ? Availability.LIMITED : Availability.AVAILABLE;
}

@Injectable()
export class PublicCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async products(f: PublicProductFilterDto) {
    const where = this.buildWhere(f);
    const dir: 'asc' | 'desc' = f.sortOrder === SortOrder.DESC ? 'desc' : 'asc';
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: f.sortBy === PublicSortField.POPULAR ? [this.orderBy(f, dir), { name: 'asc' }, { id: 'asc' }] : [this.orderBy(f, dir), { id: 'asc' }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
    ]);
    return {
      data: (rows as PublicRow[]).map((p) => this.toDto(p)),
      pagination: buildPagination(f.page, f.limit, total),
    };
  }

  /** Ficha pública (mejora n.° 36) con productos relacionados de la misma categoría. */
  async product(id: string) {
    const p = (await this.prisma.product.findFirst({
      where: { id, ...this.visible() },
      select: PUBLIC_SELECT,
    })) as PublicRow | null;
    if (!p) throw new NotFoundException('Producto no encontrado');
    const related = p.category
      ? ((await this.prisma.product.findMany({
          where: { ...this.visible(), categoryId: p.category.id, NOT: { id } },
          select: PUBLIC_SELECT,
          orderBy: [{ saleItems: { _count: 'desc' } }, { name: 'asc' }],
          take: 4,
        })) as PublicRow[])
      : [];
    return { ...this.toDto(p), related: related.map((r) => this.toDto(r)) };
  }

  /** Filtros del catálogo: solo categorías/marcas activas que tienen productos visibles. */
  async categories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true, products: { some: this.visible() } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return rows;
  }

  async brands() {
    const rows = await this.prisma.brand.findMany({
      where: { isActive: true, products: { some: this.visible() } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return rows;
  }

  // ───────────────────────── helpers ─────────────────────────

  /**
   * Producto activo, con precio comercial ya fijado, cuya categoría y marca (si tiene) también
   * están activas. Un producto recién dado de alta "sin precio" no se publica todavía.
   */
  private visible(): Prisma.ProductWhereInput {
    return {
      isActive: true,
      salePrice: { gt: 0 },
      AND: [
        { OR: [{ categoryId: null }, { category: { isActive: true } }] },
        { OR: [{ brandId: null }, { brand: { isActive: true } }] },
      ],
    };
  }

  private orderBy(f: PublicProductFilterDto, dir: 'asc' | 'desc'): Prisma.ProductOrderByWithRelationInput {
    if (f.sortBy === PublicSortField.PRICE) return { salePrice: dir };
    // "Más vendidos": cuántas ventas incluyen el producto (siempre de mayor a menor).
    if (f.sortBy === PublicSortField.POPULAR) return { saleItems: { _count: 'desc' } };
    return { name: dir };
  }

  private buildWhere(f: PublicProductFilterDto): Prisma.ProductWhereInput {
    const minStock = this.prisma.product.fields.minStock;
    const price = {
      ...(f.minPrice !== undefined && { gte: f.minPrice }),
      ...(f.maxPrice !== undefined && { lte: f.maxPrice }),
    };
    return {
      ...this.visible(),
      ...(f.categoryId && { categoryId: f.categoryId }),
      ...(f.brandId && { brandId: f.brandId }),
      // Se combina con salePrice > 0 de visible() en un AND explícito.
      ...((f.minPrice !== undefined || f.maxPrice !== undefined) && {
        AND: [...(this.visible().AND as Prisma.ProductWhereInput[]), { salePrice: price }],
      }),
      ...(f.availability === Availability.OUT_OF_STOCK && { stock: { lte: 0 } }),
      ...(f.availability === Availability.LIMITED && { stock: { gt: 0, lte: minStock } }),
      ...(f.availability === Availability.AVAILABLE && { stock: { gt: minStock } }),
      ...(f.search && {
        OR: [
          { name: { contains: f.search, mode: 'insensitive' as const } },
          { sku: { contains: f.search, mode: 'insensitive' as const } },
          { description: { contains: f.search, mode: 'insensitive' as const } },
        ],
      }),
    };
  }

  private toDto(p: PublicRow) {
    const price = decimalToNumber(p.salePrice);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      // Precio 0 = "consulte precio": no se publica.
      price: price > 0 ? price : null,
      availability: availabilityOf(p.stock, p.minStock),
      unit: UNIT_LABEL[p.unit ?? 'UNIT'] ?? 'unidad',
      imageUrl: p.imageUrl ?? null,
    };
  }
}