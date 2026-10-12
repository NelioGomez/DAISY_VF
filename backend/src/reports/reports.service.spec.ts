import { BadRequestException } from '@nestjs/common';
import { ReportName } from './dto/report.dto';
import { ReportsService } from './reports.service';

const actor = { id: 'u1', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const UUID = '11111111-1111-4111-8111-111111111111';

function build(rows: unknown[] = []) {
  const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) };
  const audit = { log: jest.fn() };
  return { service: new ReportsService(prisma as never, audit as never), prisma, audit };
}
const sqlOf = (prisma: { $queryRaw: jest.Mock }, call = 0) => prisma.$queryRaw.mock.calls[call][0] as { text: string; values: unknown[] };

describe('ReportsService', () => {
  it('sin fechas usa los últimos 30 días y los devuelve en filters', async () => {
    const { service } = build();
    const r = await service.run(ReportName.SALES_BY_PERIOD, {});
    const days = (new Date(String(r.filters.to)).getTime() - new Date(String(r.filters.from)).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it('inventario y cobranza son "a hoy": no llevan rango de fechas', async () => {
    const { service } = build();
    expect((await service.run(ReportName.INVENTORY, { from: '2026-01-01' })).filters.from).toBeNull();
    expect((await service.run(ReportName.RECEIVABLES, {})).filters.to).toBeNull();
  });

  it('rango invertido → 400', async () => {
    const { service } = build();
    await expect(service.run(ReportName.PAYMENTS, { from: '2026-02-01', to: '2026-01-01' })).rejects.toThrow(BadRequestException);
  });

  it('ventas por período: solo ventas vigentes, filtros como parámetros (no concatenados)', async () => {
    const { service, prisma } = build();
    await service.run(ReportName.SALES_BY_PERIOD, { customerId: UUID, paymentMethod: 'CASH' as never, groupBy: 'month' as never });
    const q = sqlOf(prisma);
    expect(q.text).toContain("s.status = 'ACTIVE'");
    expect(q.text).toContain("date_trunc('month'");
    expect(q.values).toEqual(expect.arrayContaining([UUID, 'CASH']));
    expect(q.text).not.toContain(UUID);
  });

  it('calcula margen = subtotal − costo y suma el resumen', async () => {
    const { service } = build([
      { period: '2026-03-01', invoices: 2, subtotal: '500.00', tax: '75.00', total: '575.00', cost: '300.0000' },
      { period: '2026-03-02', invoices: 1, subtotal: '100.00', tax: '15.00', total: '115.00', cost: '40.0000' },
    ]);
    const r = await service.run(ReportName.SALES_BY_PERIOD, { from: '2026-03-01', to: '2026-03-31' });
    expect(r.rows[0]).toMatchObject({ period: '2026-03-01', invoices: 2, total: 575, margin: 200 });
    expect(r.summary).toEqual({ invoices: 3, subtotal: 600, tax: 90, total: 690, cost: 340, margin: 260 });
  });

  it('límite: recorta filas pero el resumen cubre todas; marca truncated', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, label: `C${i}`, invoices: 1, subtotal: '10', tax: '1.5', total: '11.5', cost: '4', balance: '0' }));
    const { service } = build(rows);
    const r = await service.run(ReportName.SALES_BY_CUSTOMER, { limit: 2 });
    expect(r.rows).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(r.summary.invoices).toBe(5);
  });

  it('ventas por método con filtro de método no lo duplica en la condición', async () => {
    const { service, prisma } = build();
    await service.run(ReportName.SALES_BY_PAYMENT_METHOD, { paymentMethod: 'CASH' as never });
    expect(sqlOf(prisma).text).not.toContain('"PaymentMethod"');
  });

  it('cuentas por cobrar: antigüedad en tramos', async () => {
    const day = 86_400;
    const now = Math.floor(Date.now() / 1000);
    const mk = (n: string, dueOffsetDays: number | null, balance: string) => ({
      invoice_number: n, customer: 'C', sold_at: '2026-01-01', due_date: '2026-01-02',
      due_epoch: dueOffsetDays === null ? null : now + dueOffsetDays * day, total: balance, balance,
    });
    const { service } = build([mk('A', 10, '100'), mk('B', -15, '50'), mk('C', -45, '25'), mk('D', -75, '10'), mk('E', -120, '5'), mk('F', null, '1')]);
    const r = await service.run(ReportName.RECEIVABLES, {});
    expect(r.summary).toMatchObject({
      invoices: 6, totalReceivable: 191, current: 101, overdue1to30: 50, overdue31to60: 25, overdue61to90: 10, overdueOver90: 5,
    });
    expect(r.rows.find((x) => x.invoice === 'B')).toMatchObject({ daysOverdue: 15, bucket: '1-30 días' });
  });

  it('cotizaciones: tasa de conversión sobre enviadas (sin borradores)', async () => {
    const { service } = build([
      { status: 'CONVERTED', quotations: 1, total: '300' },
      { status: 'PENDING', quotations: 1, total: '100' },
      { status: 'REJECTED', quotations: 1, total: '50' },
      { status: 'DRAFT', quotations: 5, total: '999' },
    ]);
    const r = await service.run(ReportName.QUOTATIONS, {});
    expect(r.summary.conversionRate).toBe(33.3);
    expect(r.summary.quotations).toBe(8);
  });

  it('movimientos: LIMIT + 1 para detectar recorte', async () => {
    const { service, prisma } = build([]);
    await service.run(ReportName.INVENTORY_MOVEMENTS, { limit: 10 });
    expect(sqlOf(prisma, 0).values).toContain(11);
  });

  it('exportar CSV: encabezados en español, BOM, auditoría y nombre de archivo', async () => {
    const { service, audit } = build([{ status: 'CONVERTED', quotations: 1, total: '300' }]);
    const { csv, filename } = await service.exportCsv(ReportName.QUOTATIONS, {}, actor, '1.2.3.4');
    expect(csv.startsWith('﻿Estado,Cotizaciones,Monto cotizado')).toBe(true);
    expect(csv).toContain('CONVERTED,1,300');
    expect(filename).toMatch(/^quotations-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'reports', action: 'EXPORT', entityId: 'quotations' }));
  });

  it('el catálogo de reportes lista los 11 reportes', () => {
    expect(build().service.catalog()).toHaveLength(11);
  });
});