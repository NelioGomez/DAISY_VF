import { DashboardService } from './dashboard.service';

const user = (role: string, permissions: string[]) => ({ id: 'u1', username: 'x', role, permissions }) as never;

function build() {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
  return { service: new DashboardService(prisma as never), prisma };
}

describe('DashboardService', () => {
  it('Administrador: todas las secciones, serie de 14 días con ceros y sin alertas si no hay datos', async () => {
    const { service } = build();
    const d = await service.summary(user('ADMIN', []));
    expect(d.sales).not.toBeNull();
    expect(d.sales!.salesByDay).toHaveLength(14);
    expect(d.sales!.salesByDay.every((x) => x.total === 0)).toBe(true);
    expect(d.sales!.last30Days).toEqual({ total: 0, invoices: 0 });
    expect(d.inventory!.restock).toEqual([]);
    expect(d.alerts).toEqual([]);
    expect(Object.keys(d.sales!.salesByDay[0])).toEqual(['day', 'total', 'invoices']);
  });

  it('los días de la serie son consecutivos y terminan hoy (hora de Nicaragua)', async () => {
    const { service } = build();
    const d = await service.summary(user('ADMIN', []));
    const days = d.sales!.salesByDay.map((x) => x.day);
    expect(days).toEqual([...days].sort());
    expect(new Set(days).size).toBe(14);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua' }).format(new Date());
    expect(days[13]).toBe(today);
  });

  it('un técnico solo recibe OPI y no ejecuta consultas de ventas/inventario', async () => {
    const { service, prisma } = build();
    const d = await service.summary(user('TECHNICIAN', ['dashboard:read', 'service-orders:read']));
    expect(d.sales).toBeNull();
    expect(d.inventory).toBeNull();
    expect(d.receivables).toBeNull();
    expect(d.quotations).toBeNull();
    expect(d.serviceOrders).not.toBeNull();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const q = prisma.$queryRaw.mock.calls[0][0];
    expect(q.text).toContain('technician_id = $1::uuid');
    expect(q.values).toEqual(['u1']);
  });

  it('el valor del inventario (costos) solo con inventory:read', async () => {
    const { service } = build();
    const onlyProducts = await service.summary(user('SELLER', ['dashboard:read', 'products:read']));
    expect(onlyProducts.inventory!.stockValue).toBeNull();
    const withInv = await service.summary(user('MANAGEMENT', ['dashboard:read', 'inventory:read']));
    expect(withInv.inventory!.stockValue).toBe(0);
  });

  it('genera alertas ordenadas por tipo según los datos', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockImplementation((s: { text: string }) => {
      if (s.text.includes('out_of_stock')) return Promise.resolve([{ products: 10, critical: 4, out_of_stock: 1, stock_value: '100' }]);
      if (s.text.includes('open_invoices')) return Promise.resolve([{ open_invoices: 3, balance: '500', overdue_invoices: 2, overdue_balance: '300' }]);
      if (s.text.includes('FROM web_inquiries')) return Promise.resolve([{ new_count: 2 }]);
      if (s.text.includes('FROM quotations')) return Promise.resolve([{ pending: 1, approved: 0, expiring: 1 }]);
      return Promise.resolve([]);
    });
    const d = await service.summary(user('ADMIN', []));
    expect(d.alerts.map((a) => a.type)).toEqual(['OUT_OF_STOCK', 'LOW_STOCK', 'OVERDUE_RECEIVABLES', 'QUOTATIONS_EXPIRING', 'NEW_INQUIRIES']);
    expect(d.alerts[1]).toMatchObject({ count: 3, severity: 'warning' }); // 4 críticos − 1 agotado
    expect(d.alerts[2].message).toContain('C$ 300.00');
  });

  it('tendencia, conversión, antigüedad de CxC y pendientes de compras y OPI', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockImplementation((s: { text: string }) => {
      if (s.text.includes('prev_total')) return Promise.resolve([{ last_total: '900', last_count: 3, prev_total: '600', prev_count: 2 }]);
      if (s.text.includes('open_invoices'))
        return Promise.resolve([{ open_invoices: 3, balance: '500', due_soon: 1, current_n: 1, current_amt: '200', d31_60_n: 2, d31_60_amt: '300' }]);
      if (s.text.includes('FROM quotations')) return Promise.resolve([{ issued_last: 4, converted_last: 1, issued_prev: 2, converted_prev: 2, approved: 1 }]);
      if (s.text.includes('FROM purchases')) return Promise.resolve([{ to_receive: 3, late: 1 }]);
      if (s.text.includes('FROM service_orders')) return Promise.resolve([{ status: 'REGISTERED', orders: 2 }]);
      return Promise.resolve([]);
    });
    const d = await service.summary(user('ADMIN', []));
    expect(d.sales?.previous30Days).toEqual({ total: 600, invoices: 2 });
    expect(d.quotations?.conversion.last30Days).toEqual({ issued: 4, converted: 1 });
    expect(d.receivables?.aging.map((a) => [a.key, a.invoices, a.amount])).toEqual([
      ['current', 1, 200], ['d1_30', 0, 0], ['d31_60', 2, 300], ['d61_90', 0, 0], ['d90plus', 0, 0],
    ]);
    const types = d.alerts.map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['RECEIVABLES_DUE_SOON', 'QUOTATIONS_APPROVED', 'PURCHASES_LATE', 'PURCHASES_TO_RECEIVE', 'SERVICE_ORDERS_UNASSIGNED']));
    expect(d.alerts.find((a) => a.type === 'PURCHASES_TO_RECEIVE')?.count).toBe(2); // 3 por recibir − 1 atrasada
  });

  it('compras solo con purchases:read; un técnico ve sus órdenes asignadas', async () => {
    const { service, prisma } = build();
    prisma.$queryRaw.mockImplementation((s: { text: string }) =>
      Promise.resolve(s.text.includes('FROM service_orders') ? [{ status: 'ASSIGNED', orders: 1 }, { status: 'IN_PROGRESS', orders: 1 }] : []),
    );
    const d = await service.summary(user('TECHNICIAN', ['service-orders:read']));
    expect(d.purchases).toBeNull();
    expect(d.alerts).toEqual([expect.objectContaining({ type: 'SERVICE_ORDERS_ASSIGNED', count: 2 })]);
  });
});
