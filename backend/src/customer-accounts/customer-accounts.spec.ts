import { BadRequestException, ConflictException } from '@nestjs/common';
import { CustomerAccountsService } from './customer-accounts.service';

const actor = { id: 'admin-id', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const account = {
  id: 'a1', email: 'maria@elpiston.example', contactName: 'María Pérez', phone: null, isActive: true, lastLoginAt: null, createdAt: new Date(),
  customer: { id: 'c1', name: 'Taller El Pistón', ruc: 'J031', isActive: true }, _count: { inquiries: 2 },
};

function build() {
  const tx = { customerAccount: { update: jest.fn() }, customer: { update: jest.fn() } };
  const prisma = {
    customerAccount: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([account]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(account),
      create: jest.fn(({ data }) => Promise.resolve({ ...account, ...data })),
      update: jest.fn(({ data }) => Promise.resolve({ ...account, ...data })),
    },
    customer: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Taller El Pistón', isActive: true }) },
    $transaction: jest.fn((arg: unknown) => (typeof arg === 'function' ? (arg as (t: typeof tx) => unknown)(tx) : Promise.all(arg as Promise<unknown>[]))),
  };
  const audit = { log: jest.fn() };
  return { prisma, tx, audit, service: new CustomerAccountsService(prisma as never, audit as never) };
}

describe('CustomerAccountsService (mejora n.° 70)', () => {
  it('busca por correo, contacto, cliente o RUC y filtra por estado', async () => {
    const { prisma, service } = build();
    await service.findAll({ page: 1, limit: 20, search: 'piston', isActive: true } as never);
    const where = prisma.customerAccount.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.OR).toHaveLength(4);
    expect(prisma.customerAccount.findMany.mock.calls[0][0].select.passwordHash).toBeUndefined();
  });

  it('crea la cuenta para un cliente existente con la política de contraseñas', async () => {
    const { prisma, audit, service } = build();
    const dto = { customerId: 'c1', email: 'compras@elpiston.example', contactName: 'Ana', password: 'Temporal#2026x' };
    await service.create(dto as never, actor);
    const data = prisma.customerAccount.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ customerId: 'c1', email: 'compras@elpiston.example', contactName: 'Ana', phone: null });
    expect(data.passwordHash).not.toBe(dto.password);
    expect(audit.log.mock.calls[0][0]).toMatchObject({ module: 'customer-accounts', action: 'CREATE' });
    await expect(service.create({ ...dto, password: 'corta' } as never, actor)).rejects.toThrow(BadRequestException);
  });

  it('no crea cuentas para clientes inactivos ni repite correos', async () => {
    const { prisma, service } = build();
    prisma.customer.findUnique.mockResolvedValueOnce({ id: 'c1', name: 'X', isActive: false });
    await expect(service.create({ customerId: 'c1', email: 'x@y.com', contactName: 'X', password: 'Temporal#2026x' } as never, actor)).rejects.toThrow(BadRequestException);
    prisma.customerAccount.findFirst.mockResolvedValueOnce({ id: 'otra' });
    await expect(service.create({ customerId: 'c1', email: 'x@y.com', contactName: 'X', password: 'Temporal#2026x' } as never, actor)).rejects.toThrow(ConflictException);
  });

  it('cambiar el correo de acceso también corrige la ficha del cliente si era el mismo', async () => {
    const { prisma, tx, audit, service } = build();
    prisma.customerAccount.findUnique.mockResolvedValueOnce({ email: 'maria@elpiston.example', contactName: 'María Pérez', phone: null, customerId: 'c1', customer: { email: 'MARIA@elpiston.example' } });
    await service.update('a1', { email: 'maria.perez@elpiston.example' } as never, actor);
    expect(tx.customerAccount.update.mock.calls[0][0].data).toEqual({ email: 'maria.perez@elpiston.example', emailVerifiedAt: null });
    expect(tx.customer.update.mock.calls[0][0].data).toEqual({ email: 'maria.perez@elpiston.example' });
    expect(audit.log.mock.calls[0][0].description).toContain('correo maria@elpiston.example → maria.perez@elpiston.example');
  });

  it('restablecer y cerrar sesiones invalidan los tokens del cliente', async () => {
    const { prisma, service } = build();
    await service.resetPassword('a1', 'Temporal#2026x', actor);
    expect(prisma.customerAccount.update.mock.calls[0][0].data.passwordChangedAt).toBeInstanceOf(Date);
    await service.revokeSessions('a1', actor);
    expect(prisma.customerAccount.update.mock.calls[1][0].data).toEqual({ passwordChangedAt: expect.any(Date) });
  });
});
