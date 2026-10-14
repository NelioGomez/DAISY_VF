import { NotFoundException } from '@nestjs/common';
import { AuditQueryService } from './audit-query.service';
import { FilterAuditDto } from './dto/audit.dto';

const actor = { id: 'u1', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const log = (over: Record<string, unknown> = {}) => ({
  id: 'a1', userId: 'u1', username: 'ana', module: 'sales', action: 'VOID', entity: 'Sale', entityId: 's1',
  description: 'Venta FAC-1 anulada: =cmd', ip: '1.1.1.1', metadata: { refundDue: 10 }, createdAt: new Date('2026-03-01T10:00:00Z'), ...over,
});

function build(rows: unknown[] = [log()]) {
  const prisma = {
    auditLog: {
      count: jest.fn().mockResolvedValue(42),
      findMany: jest.fn().mockResolvedValue(rows),
      findUnique: jest.fn().mockResolvedValue(rows[0] ?? null),
      groupBy: jest.fn().mockImplementation(({ by }) => Promise.resolve(by[0] === 'module' ? [{ module: 'auth' }, { module: 'sales' }] : [{ action: 'LOGIN' }, { action: 'VOID' }])),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const audit = { log: jest.fn() };
  return { prisma, audit, service: new AuditQueryService(prisma as never, audit as never) };
}
const filter = (o: Record<string, unknown> = {}) => Object.assign(new FilterAuditDto(), o);

describe('AuditQueryService', () => {
  it('lista paginada, más reciente primero', async () => {
    const { prisma, service } = build();
    const res = await service.findAll(filter({ page: 3, limit: 10 }));
    expect(res.pagination).toEqual({ page: 3, limit: 10, total: 42, totalPages: 5 });
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.skip).toBe(20);
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('traduce los filtros (módulo/acción exactos, usuario y texto insensibles a mayúsculas, fechas en hora de Nicaragua)', async () => {
    const { prisma, service } = build();
    await service.findAll(filter({ module: 'sales', action: 'VOID', username: 'AN', search: 'anulada', entity: 'Sale', entityId: 's1', from: '2026-03-01', to: '2026-03-02' }));
    const where = prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      module: 'sales', action: 'VOID', entity: 'Sale', entityId: 's1',
      username: { contains: 'AN', mode: 'insensitive' },
      description: { contains: 'anulada', mode: 'insensitive' },
    });
    expect(where.createdAt.gte.toISOString()).toBe('2026-03-01T06:00:00.000Z');
    expect(where.createdAt.lte.toISOString()).toBe('2026-03-03T05:59:59.999Z');
  });

  it('detalle: devuelve metadata; inexistente → 404', async () => {
    expect((await build().service.findOne('a1')).metadata).toEqual({ refundDue: 10 });
    await expect(build([]).service.findOne('x')).rejects.toThrow(NotFoundException);
  });

  it('filtros disponibles: módulos y acciones', async () => {
    expect(await build().service.filters()).toEqual({ modules: ['auth', 'sales'], actions: ['LOGIN', 'VOID'] });
  });

  it('exportar CSV: neutraliza fórmulas, serializa metadata y audita la exportación', async () => {
    const { service, audit } = build([log({ description: '=HYPERLINK("x")' })]);
    const csv = await service.exportCsv(filter(), actor, '2.2.2.2');
    expect(csv.startsWith('﻿Fecha y hora (UTC),Usuario,Módulo')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"{""refundDue"":10}"');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'audit', action: 'EXPORT', ip: '2.2.2.2' }));
  });

  it('no existen operaciones de escritura sobre la bitácora', () => {
    const methods = Object.getOwnPropertyNames(AuditQueryService.prototype);
    expect(methods.filter((m) => /create|update|delete|remove/i.test(m))).toEqual([]);
  });
});
