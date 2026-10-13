import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { canMoveInquiry } from '../inquiries/inquiry-status';
import { InquiriesService } from '../inquiries/inquiries.service';
import { Availability, CreateInquiryDto, PublicProductFilterDto } from './dto/public.dto';
import { availabilityOf, PublicCatalogService } from './public-catalog.service';

const REF = Symbol('minStock');
const dec = (v: string) => ({ toString: () => v });

function buildCatalog(rows: unknown[] = []) {
  const prisma = {
    product: {
      fields: { minStock: REF },
      count: jest.fn().mockResolvedValue(rows.length),
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue(rows[0] ?? null),
    },
    category: { findMany: jest.fn().mockResolvedValue([{ id: 'c', name: 'Cat' }]) },
    brand: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { prisma, service: new PublicCatalogService(prisma as never) };
}
const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', sku: 'S1', name: 'Boquilla', description: null, salePrice: dec('100.00'), stock: 10, minStock: 5,
  category: null, brand: null, ...over,
});
const filter = (o: Record<string, unknown> = {}) => Object.assign(new PublicProductFilterDto(), o);

describe('Catálogo público', () => {
  it('disponibilidad: agotado / limitado / disponible', () => {
    expect(availabilityOf(0, 5)).toBe(Availability.OUT_OF_STOCK);
    expect(availabilityOf(5, 5)).toBe(Availability.LIMITED);
    expect(availabilityOf(6, 5)).toBe(Availability.AVAILABLE);
  });

  it('solo productos activos con categoría/marca activas; consulta solo campos públicos', async () => {
    const { prisma, service } = buildCatalog([row()]);
    await service.products(filter());
    const args = prisma.product.findMany.mock.calls[0][0];
    expect(args.where.isActive).toBe(true);
    expect(JSON.stringify(args.where.AND)).toContain('"isActive":true');
    expect(Object.keys(args.select)).not.toEqual(expect.arrayContaining(['avgCost']));
    expect(args.select).not.toHaveProperty('avgCost');
    expect(args.select).not.toHaveProperty('version');
  });

  it('no expone costo, stock exacto ni stock mínimo en la respuesta', async () => {
    const { service } = buildCatalog([row({ stock: 7, minStock: 2 })]);
    const res = await service.products(filter());
    const item = res.data[0] as Record<string, unknown>;
    expect(item).toMatchObject({ price: 100, availability: 'AVAILABLE' });
    for (const k of ['avgCost', 'stock', 'minStock', 'cost', 'version']) expect(item).not.toHaveProperty(k);
  });

  it('precio 0 → null ("consulte precio")', async () => {
    const { service } = buildCatalog([row({ salePrice: dec('0.00') })]);
    expect((await service.products(filter())).data[0].price).toBeNull();
  });

  it('filtros de disponibilidad comparan contra el stock mínimo', async () => {
    const { prisma, service } = buildCatalog([row()]);
    await service.products(filter({ availability: Availability.LIMITED }));
    expect(prisma.product.findMany.mock.calls[0][0].where.stock).toEqual({ gt: 0, lte: REF });
    await service.products(filter({ availability: Availability.OUT_OF_STOCK }));
    expect(prisma.product.findMany.mock.calls[1][0].where.stock).toEqual({ lte: 0 });
  });

  it('la búsqueda no pisa la condición de visibilidad', async () => {
    const { prisma, service } = buildCatalog([row()]);
    await service.products(filter({ search: 'noz' }));
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(3);
    expect(where.AND).toHaveLength(2);
  });

  it('detalle de un producto no publicado → 404', async () => {
    const { service } = buildCatalog([]);
    await expect(service.product('x')).rejects.toThrow(NotFoundException);
  });
});

describe('Consultas web', () => {
  function buildInq(existing: Record<string, unknown> | null = null, updated = 1) {
    const prisma = {
      webInquiry: {
        create: jest.fn().mockResolvedValue({ id: 'i1' }),
        findUnique: jest.fn().mockResolvedValue(existing),
        updateMany: jest.fn().mockResolvedValue({ count: updated }),
      },
    };
    const audit = { log: jest.fn() } as unknown as AuditService;
    return { prisma, audit, service: new InquiriesService(prisma as never, audit) };
  }
  const actor = { id: 'u1', username: 'ana', role: 'SELLER', permissions: [] } as never;
  const base = { id: 'i1', name: 'Los Pinos', contact: '88888888', productInterest: null, message: null, createdAt: new Date() };

  it('alta pública: guarda como NUEVA (por defecto) y audita sin usuario', async () => {
    const { prisma, audit, service } = buildInq();
    const res = await service.createPublic(Object.assign(new CreateInquiryDto(), { name: 'A', contact: 'a@b.com' }), '9.9.9.9');
    expect(res).toEqual({ received: true });
    expect(prisma.webInquiry.create.mock.calls[0][0].data).not.toHaveProperty('status');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'inquiries', action: 'PUBLIC_CREATE', ip: '9.9.9.9' }));
  });

  it('campo trampa lleno (bot): responde ok pero NO guarda', async () => {
    const { prisma, service } = buildInq();
    const res = await service.createPublic(Object.assign(new CreateInquiryDto(), { name: 'Bot', contact: 'a@b.com', website: 'http://spam' }));
    expect(res).toEqual({ received: true });
    expect(prisma.webInquiry.create).not.toHaveBeenCalled();
  });

  it('transiciones: NUEVA→ATENDIDA→CERRADA; no se reabre', () => {
    expect(canMoveInquiry('NEW', 'ATTENDED')).toBe(true);
    expect(canMoveInquiry('NEW', 'CLOSED')).toBe(true);
    expect(canMoveInquiry('ATTENDED', 'CLOSED')).toBe(true);
    expect(canMoveInquiry('ATTENDED', 'NEW')).toBe(false);
    expect(canMoveInquiry('CLOSED', 'NEW')).toBe(false);
  });

  it('cambiar estado: audita; transición inválida → 409; cambio concurrente → 409', async () => {
    const ok = buildInq({ ...base, status: 'NEW' });
    expect(await ok.service.setStatus('i1', 'ATTENDED' as never, actor)).toMatchObject({ status: 'ATTENDED' });
    expect(ok.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'STATUS_CHANGE', username: 'ana' }));
    await expect(buildInq({ ...base, status: 'CLOSED' }).service.setStatus('i1', 'NEW' as never, actor)).rejects.toThrow('No se puede pasar');
    await expect(buildInq({ ...base, status: 'NEW' }, 0).service.setStatus('i1', 'ATTENDED' as never, actor)).rejects.toThrow('cambió de estado');
    await expect(buildInq(null).service.setStatus('i1', 'ATTENDED' as never, actor)).rejects.toThrow(NotFoundException);
  });
});

describe('Validación de CreateInquiryDto', () => {
  const check = async (over: Record<string, unknown>) => {
    const dto = plainToInstance(CreateInquiryDto, { name: 'Los Pinos', contact: 'compras@lospinos.com', ...over });
    return { dto, fields: (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property) };
  };

  it('acepta correo o teléfono', async () => {
    expect((await check({})).fields).toEqual([]);
    expect((await check({ contact: '+505 8888-8888' })).fields).toEqual([]);
    expect((await check({ contact: '22701234' })).fields).toEqual([]);
  });

  it('rechaza contacto inválido y nombre vacío', async () => {
    expect((await check({ contact: 'hola' })).fields).toContain('contact');
    expect((await check({ contact: '123' })).fields).toContain('contact');
    expect((await check({ name: '   ' })).fields).toContain('name');
  });

  it('limita el largo del mensaje y quita caracteres de control', async () => {
    expect((await check({ message: 'x'.repeat(1001) })).fields).toContain('message');
    const { dto } = await check({ message: 'Hola\u0000\u0007 mundo\nlínea 2' });
    expect(dto.message).toBe('Hola mundo\nlínea 2');
  });

  it('rechaza campos que no existen (no se puede forzar el estado)', async () => {
    expect((await check({ status: 'CLOSED' })).fields).toContain('status');
  });
});