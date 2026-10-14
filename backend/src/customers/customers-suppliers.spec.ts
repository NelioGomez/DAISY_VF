import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customer.service';
import { CreateCustomerDto } from './dto/customer.dto';
import { CreateSupplierDto } from '../suppliers/dto/supplier.dto';
import { inferInternational, SuppliersService } from '../suppliers/dto/suppliers.service';

const actor = { id: 'u1', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const audit = { log: jest.fn() };
const base = { id: 'c1', name: 'X', ruc: null, contactName: null, phone: null, email: null, address: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };

describe('CustomersService', () => {
  const mk = () => {
    const prisma: Record<string, any> = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(base),
        create: jest.fn(({ data }) => Promise.resolve({ ...base, ...data })),
        update: jest.fn(({ data }) => Promise.resolve({ ...base, ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      sale: {
        groupBy: jest.fn().mockResolvedValue([
          { customerId: 'c1', _count: { _all: 2 }, _sum: { total: { toString: () => '500.50' }, balance: { toString: () => '100' } } },
        ]),
      },
    };
    return { prisma, service: new CustomersService(prisma as never, audit as never) };
  };

  it('RUC duplicado → 409 en el campo ruc; null no se compara', async () => {
    const { prisma, service } = mk();
    prisma.customer.findFirst.mockResolvedValue({ id: 'otro' });
    const err = await service.create({ name: 'A', ruc: 'J123' } as never, actor).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors[0].field).toBe('ruc');
    prisma.customer.findFirst.mockClear();
    await service.create({ name: 'B', ruc: null } as never, actor);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('findOne agrega total comprado y saldo pendiente de ventas vigentes', async () => {
    const { prisma, service } = mk();
    const c = await service.findOne('c1');
    expect(c).toMatchObject({ salesCount: 2, totalPurchases: 500.5, pendingBalance: 100 });
    expect(prisma.sale.groupBy.mock.calls[0][0].where.status).toBe('ACTIVE');
  });

  it('eliminar con historial → 409; sin historial → borra; inexistente → 404', async () => {
    const { prisma, service } = mk();
    prisma.customer.findUnique.mockResolvedValue({ name: 'X', _count: { quotations: 0, sales: 1, serviceOrders: 0 } });
    await expect(service.remove('c1', actor)).rejects.toThrow(ConflictException);
    expect(prisma.customer.delete).not.toHaveBeenCalled();
    prisma.customer.findUnique.mockResolvedValue({ name: 'X', _count: { quotations: 0, sales: 0, serviceOrders: 0 } });
    await service.remove('c1', actor);
    expect(prisma.customer.delete).toHaveBeenCalled();
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.remove('c1', actor)).rejects.toThrow(NotFoundException);
  });
});

describe('Validación de clientes y proveedores', () => {
  const check = async <T extends object>(cls: new () => T, plain: Record<string, unknown>) => {
    const dto = plainToInstance(cls, plain);
    return { dto, errors: (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property) };
  };

  it('cliente: RUC en mayúsculas, vacío → null, correo en minúsculas', async () => {
    const { dto, errors } = await check(CreateCustomerDto, { name: ' Gasolinera  ', ruc: ' j031-abc ', phone: '', email: 'INFO@Pinos.com' });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ name: 'Gasolinera', ruc: 'J031-ABC', phone: null, email: 'info@pinos.com' });
  });

  it('cliente: correo, teléfono y RUC inválidos', async () => {
    const { errors } = await check(CreateCustomerDto, { name: 'X', email: 'no-es-correo', phone: 'abc', ruc: 'J 12$' });
    expect(errors).toEqual(expect.arrayContaining(['email', 'phone', 'ruc']));
  });

  it('proveedor: nombre obligatorio', async () => {
    expect((await check(CreateSupplierDto, { name: '  ' })).errors).toContain('name');
  });

  it('inferInternational: Nicaragua nacional, otro país internacional, sin país nacional', () => {
    expect(inferInternational('Nicaragua')).toBe(false);
    expect(inferInternational(' nicaragua ')).toBe(false);
    expect(inferInternational('Estados Unidos')).toBe(true);
    expect(inferInternational(null)).toBe(false);
  });
});

describe('SuppliersService', () => {
  it('país extranjero → isInternational true por defecto; al editar el país se recalcula', async () => {
    const row = { id: 's1', name: 'GVR', taxId: null, country: 'Nicaragua', isInternational: false, contactName: null, phone: null, email: null, address: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const prisma: Record<string, any> = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(row),
        create: jest.fn(({ data }) => Promise.resolve({ ...row, ...data })),
        update: jest.fn(({ data }) => Promise.resolve({ ...row, ...data })),
      },
    };
    const service = new SuppliersService(prisma as never, audit as never);
    await service.create({ name: 'GVR', country: 'Estados Unidos' } as never, actor);
    expect(prisma.supplier.create.mock.calls[0][0].data.isInternational).toBe(true);
    await service.update('s1', { country: 'México' } as never, actor);
    expect(prisma.supplier.update.mock.calls[0][0].data).toMatchObject({ country: 'México', isInternational: true });
    await service.update('s1', { country: 'México', isInternational: false } as never, actor);
    expect(prisma.supplier.update.mock.calls[1][0].data.isInternational).toBe(false);
  });
});