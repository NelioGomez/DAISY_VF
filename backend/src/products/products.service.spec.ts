import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto, FilterProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

const actor = { id: 'u1', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const MIN_STOCK_REF = Symbol('product.minStock');

function buildPrisma() {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    sku: 'GIL-001',
    name: 'Boquilla',
    description: null,
    categoryId: null,
    brandId: null,
    avgCost: { toString: () => '10.5000' },
    salePrice: { toString: () => '25.00' },
    stock: 3,
    minStock: 5,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    category: null,
    brand: null,
    ...over,
  });
  const prisma = {
    product: {
      fields: { minStock: MIN_STOCK_REF },
      count: jest.fn().mockResolvedValue(45),
      findMany: jest.fn().mockResolvedValue([row()]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(row()),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    category: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    brand: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { prisma, row };
}

describe('ProductsService', () => {
  const audit = { log: jest.fn() };
  let ctx: ReturnType<typeof buildPrisma>;
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = buildPrisma();
    service = new ProductsService(ctx.prisma as never, audit as never);
  });

  describe('create', () => {
    const dto = Object.assign(new CreateProductDto(), { sku: 'GIL-001', name: 'Boquilla', salePrice: 25 });

    it('el producto nace sin stock ni costo promedio (solo cambian con movimientos)', async () => {
      await service.create(dto, actor);
      const { data } = ctx.prisma.product.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('stock');
      expect(data).not.toHaveProperty('avgCost');
      expect(data.minStock).toBe(0);
      expect(data.isActive).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'products', action: 'CREATE' }));
    });

    it('SKU duplicado → 409 con el error en el campo sku', async () => {
      ctx.prisma.product.findFirst.mockResolvedValue({ id: 'otro' });
      const err = await service.create(dto, actor).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().errors).toEqual([{ field: 'sku', message: 'El SKU ya existe' }]);
      expect(ctx.prisma.product.create).not.toHaveBeenCalled();
    });

    it('categoría inexistente → 400 con el campo categoryId', async () => {
      ctx.prisma.category.findUnique.mockResolvedValue(null);
      const err = await service
        .create({ ...dto, categoryId: '11111111-1111-4111-8111-111111111111' }, actor)
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse().errors[0].field).toBe('categoryId');
    });

    it('marca inactiva → 400', async () => {
      ctx.prisma.brand.findUnique.mockResolvedValue({ isActive: false });
      await expect(
        service.create({ ...dto, brandId: '22222222-2222-4222-8222-222222222222' }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('categoryId null quita la categoría', async () => {
      await service.update('p1', Object.assign(new UpdateProductDto(), { categoryId: null }), actor);
      expect(ctx.prisma.product.update.mock.calls[0][0].data).toEqual({ categoryId: null });
    });

    it('no toca stock ni costo aunque lleguen en el cuerpo', async () => {
      const dto = { name: 'Nuevo', stock: 999, avgCost: 1 } as unknown as UpdateProductDto;
      await service.update('p1', dto, actor);
      const { data } = ctx.prisma.product.update.mock.calls[0][0];
      expect(data).toEqual({ name: 'Nuevo' });
    });

    it('producto inexistente → 404', async () => {
      ctx.prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.update('x', {}, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('con movimientos o ventas → 409 y NO borra', async () => {
      ctx.prisma.product.findUnique.mockResolvedValue({
        sku: 'GIL-001',
        _count: { movements: 2, saleItems: 0, quotationItems: 0 },
      });
      await expect(service.remove('p1', actor)).rejects.toThrow(ConflictException);
      expect(ctx.prisma.product.delete).not.toHaveBeenCalled();
    });

    it('sin referencias → elimina', async () => {
      ctx.prisma.product.findUnique.mockResolvedValue({
        sku: 'GIL-001',
        _count: { movements: 0, saleItems: 0, quotationItems: 0 },
      });
      await service.remove('p1', actor);
      expect(ctx.prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('findAll', () => {
    it('stock crítico compara stock contra la columna stockMínimo', async () => {
      const filter = Object.assign(new FilterProductDto(), { page: 2, limit: 20, lowStock: true });
      const res = await service.findAll(filter);
      const args = ctx.prisma.product.findMany.mock.calls[0][0];
      expect(args.where.stock).toEqual({ lte: MIN_STOCK_REF });
      expect(args.skip).toBe(20);
      expect(res.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
    });

    it('expone números y la bandera lowStock', async () => {
      const res = await service.findAll(Object.assign(new FilterProductDto(), { page: 1, limit: 20 }));
      expect(res.data[0]).toMatchObject({ avgCost: 10.5, salePrice: 25, stock: 3, lowStock: true });
    });

    it('búsqueda es insensible a mayúsculas en sku, nombre y descripción', async () => {
      await service.findAll(Object.assign(new FilterProductDto(), { page: 1, limit: 20, search: 'noz' }));
      const { OR } = ctx.prisma.product.findMany.mock.calls[0][0].where;
      expect(OR).toHaveLength(3);
      expect(OR[0].sku.mode).toBe('insensitive');
    });
  });

  describe('exportCsv', () => {
    it('genera encabezados y filas, y audita la exportación', async () => {
      const csv = await service.exportCsv(new FilterProductDto(), actor);
      expect(csv.startsWith('﻿SKU,Nombre,Marca')).toBe(true);
      expect(csv).toContain('GIL-001,Boquilla');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPORT' }));
    });
  });
});

describe('Validación de CreateProductDto', () => {
  const base = { sku: 'gil-001', name: 'Boquilla', salePrice: 25 };
  const check = async (over: Record<string, unknown>) => {
    const dto = plainToInstance(CreateProductDto, { ...base, ...over });
    return { dto, errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }) };
  };
  const fields = (errors: { property: string }[]) => errors.map((e) => e.property);

  it('datos válidos y SKU normalizado a mayúsculas', async () => {
    const { dto, errors } = await check({ sku: '  gil-001 ' });
    expect(errors).toHaveLength(0);
    expect(dto.sku).toBe('GIL-001');
  });

  it('SKU obligatorio', async () => {
    expect(fields((await check({ sku: '' })).errors)).toContain('sku');
  });

  it('SKU con espacios internos o símbolos inválidos', async () => {
    expect(fields((await check({ sku: 'AB 12' })).errors)).toContain('sku');
    expect(fields((await check({ sku: 'AB$12' })).errors)).toContain('sku');
  });

  it('nombre obligatorio', async () => {
    expect(fields((await check({ name: '   ' })).errors)).toContain('name');
  });

  it('precio negativo o con más de 2 decimales', async () => {
    expect(fields((await check({ salePrice: -1 })).errors)).toContain('salePrice');
    expect(fields((await check({ salePrice: 10.123 })).errors)).toContain('salePrice');
  });

  it('stock mínimo negativo o decimal', async () => {
    expect(fields((await check({ minStock: -2 })).errors)).toContain('minStock');
    expect(fields((await check({ minStock: 1.5 })).errors)).toContain('minStock');
  });

  it('rechaza enviar stock o costo promedio al crear (forbidNonWhitelisted)', async () => {
    expect(fields((await check({ stock: 10 })).errors)).toContain('stock');
    expect(fields((await check({ avgCost: 5 })).errors)).toContain('avgCost');
  });
});