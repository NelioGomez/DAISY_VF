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
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
}

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
        orderBy: [f.sortBy === PublicSortField.PRICE ? { salePrice: dir } : { name: dir }, { id: 'asc' }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
    ]);
    return {
      data: (rows as PublicRow[]).map((p) => this.toDto(p)),
      pagination: buildPagination(f.page, f.limit, total),
    };
  }

  async product(id: string) {
    const p = (await this.prisma.product.findFirst({
      where: { id, ...this.visible() },
      select: PUBLIC_SELECT,
    })) as PublicRow | null;
    if (!p) throw new NotFoundException('Producto no encontrado');
    return this.toDto(p);
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

  /** Producto activo cuya categoría y marca (si tiene) también están activas. */
  private visible(): Prisma.ProductWhereInput {
    return {
      isActive: true,
      AND: [
        { OR: [{ categoryId: null }, { category: { isActive: true } }] },
        { OR: [{ brandId: null }, { brand: { isActive: true } }] },
      ],
    };
  }

  private buildWhere(f: PublicProductFilterDto): Prisma.ProductWhereInput {
    const minStock = this.prisma.product.fields.minStock;
    return {
      ...this.visible(),
      ...(f.categoryId && { categoryId: f.categoryId }),
      ...(f.brandId && { brandId: f.brandId }),
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
    };
  }
}