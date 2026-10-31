import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

const user = (role: string, permissions: string[]) => ({ id: 'u1', username: 'x', role, permissions }) as never;
const dec = (v: string) => ({ toString: () => v });

function build(customer: unknown = { id: 'c1', name: 'Estación Los Pinos' }) {
  const prisma = {
    customer: { findUnique: jest.fn().mockResolvedValue(customer) },
    sale: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _count: { _all: 4 }, _sum: { total: dec('1000'), balance: dec('250') } })
        .mockResolvedValueOnce({ _count: { _all: 1 }, _sum: { balance: dec('100') } }),
      findFirst: jest.fn().mockResolvedValue({ soldAt: new Date('2026-10-20') }),
      findMany: jest.fn().mockResolvedValue([{ id: 's1', total: dec('250'), balance: dec('250') }]),
    },
    quotation: { findMany: jest.fn().mockResolvedValue([]) },
    webInquiry: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', _count: { items: 3 } }]) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    serviceOrder: { findMany: jest.fn().mockResolvedValue([]) },
    customerAccount: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return { prisma, service: new CustomersService(prisma as never, {} as never) };
}

describe('Perfil 360° del cliente', () => {
  it('indicadores: total, saldo, vencido, ticket promedio y última compra', async () => {
    const { service } = build();
    const r = await service.summary('c1', user('ADMIN', []));
    expect(r.stats).toMatchObject({ salesCount: 4, totalPurchases: 1000, pendingBalance: 250, overdueInvoices: 1, overdueBalance: 100, averageTicket: 250 });
    expect(r.inquiries).toEqual([{ id: 'i1', items: 3 }]);
    expect(r.sales?.[0]).toMatchObject({ total: 250, balance: 250 });
  });

  it('cada historial depende del permiso de su módulo', async () => {
    const { prisma, service } = build();
    const r = await service.summary('c1', user('SELLER', ['customers:read', 'quotations:read']));
    expect(r.sales).toBeNull();
    expect(r.payments).toBeNull();
    expect(r.quotations).toEqual([]);
    expect(prisma.sale.findMany).not.toHaveBeenCalled();
  });

  it('404 si el cliente no existe', async () => {
    const { service } = build(null);
    await expect(service.summary('x', user('ADMIN', []))).rejects.toBeInstanceOf(NotFoundException);
  });
});
