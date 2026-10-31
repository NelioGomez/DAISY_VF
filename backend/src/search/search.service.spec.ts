import { SearchService } from './search.service';

const user = (role: string, permissions: string[], id = 'u1') => ({ id, username: 'x', role, permissions }) as never;
const dec = (v: string) => ({ toString: () => v });

function build() {
  const model = (rows: unknown[]) => ({ findMany: jest.fn().mockResolvedValue(rows) });
  const prisma = {
    product: model([{ id: 'p1', sku: 'BQ-1', name: 'Boquilla', stock: 4, isActive: true, category: { name: 'Boquillas' } }]),
    customer: model([{ id: 'c1', name: 'Estación Boquerón', ruc: 'J01', contactName: 'Ana', phone: null }]),
    supplier: model([]),
    sale: model([{ id: 's1', invoiceNumber: 'FAC-000001', total: dec('100'), status: 'ACTIVE', paymentStatus: 'PAID', soldAt: new Date(), customer: { name: 'X' } }]),
    quotation: model([]),
    webInquiry: model([]),
    purchase: model([]),
    serviceOrder: model([{ id: 'o1', code: 'OPI-000001', description: 'Cambio de boquilla', status: 'ASSIGNED', customer: { name: 'X' } }]),
    productionOrder: model([]),
    productionLot: model([]),
  };
  return { prisma, service: new SearchService(prisma as never) };
}

describe('Búsqueda global', () => {
  it('el administrador busca en todos los módulos', async () => {
    const { service } = build();
    const r = await service.search(user('ADMIN', []), 'boq', 5);
    expect(r.results.map((x) => x.type)).toEqual(['PRODUCT', 'CUSTOMER', 'SALE', 'SERVICE_ORDER']);
    expect(r.results[0]).toMatchObject({ code: 'BQ-1', subtitle: 'Boquillas · 4 en stock' });
    expect(r.results[2]).toMatchObject({ code: 'FAC-000001', amount: 100, status: 'PAID' });
  });

  it('solo consulta los módulos que el rol puede leer', async () => {
    const { prisma, service } = build();
    const r = await service.search(user('SELLER', ['products:read', 'quotations:read']), 'boq', 5);
    expect(r.results.map((x) => x.type)).toEqual(['PRODUCT']);
    expect(prisma.sale.findMany).not.toHaveBeenCalled();
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('encuentra órdenes de producción y lotes por su código (solo con production:read)', async () => {
    const { prisma, service } = build();
    prisma.productionOrder.findMany.mockResolvedValue([{ id: 'op1', code: 'OP-000001', quantity: 5, status: 'COMPLETED', product: { sku: 'MNG-34-10P', name: 'Manguera 3/4"' } }]);
    prisma.productionLot.findMany.mockResolvedValue([
      { id: 'l1', code: 'LOT-000001', quantity: 5, releasedQuantity: 4, status: 'RELEASED', order: { code: 'OP-000001' }, product: { name: 'Manguera 3/4"' } },
    ]);
    const r = await service.search(user('INVENTORY_MANAGER', ['production:read']), 'op-0', 5);
    expect(r.results).toEqual([
      expect.objectContaining({ type: 'PRODUCTION_ORDER', code: 'OP-000001', subtitle: '5 u. · MNG-34-10P' }),
      expect.objectContaining({ type: 'PRODUCTION_LOT', code: 'LOT-000001', subtitle: 'OP-000001 · 4 de 5 liberadas' }),
    ]);
    const vendedor = build();
    await vendedor.service.search(user('SELLER', ['products:read']), 'op-0', 5);
    expect(vendedor.prisma.productionOrder.findMany).not.toHaveBeenCalled();
  });

  it('un técnico solo encuentra sus propias órdenes', async () => {
    const { prisma, service } = build();
    await service.search(user('TECHNICIAN', ['service-orders:read'], 'tec-9'), 'opi', 5);
    expect(prisma.serviceOrder.findMany.mock.calls[0][0].where).toMatchObject({ technicianId: 'tec-9' });
  });
});
