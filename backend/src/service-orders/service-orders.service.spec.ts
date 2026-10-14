import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { ServiceOrdersService } from './service-orders.service';

const admin = { id: 'a1', username: 'admin', role: 'ADMIN', permissions: [] } as never;
const tech = { id: 't1', username: 'tec', role: 'TECHNICIAN', permissions: [] } as never;

function build(order: Record<string, unknown> | null = null) {
  const tx: Record<string, any> = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    customer: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, role: { code: 'TECHNICIAN' } }) },
    sale: { findUnique: jest.fn().mockResolvedValue({ customerId: 'c1', status: 'ACTIVE' }) },
    documentSequence: { upsert: jest.fn().mockResolvedValue({ lastValue: 5 }) },
    serviceOrder: {
      findUnique: jest.fn().mockResolvedValue(order),
      create: jest.fn(({ data }) => Promise.resolve({ id: 'o1', ...data })),
      update: jest.fn(({ data }) => Promise.resolve({ ...order, ...data })),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: any) => (typeof fn === 'function' ? fn(tx) : Promise.all(fn))),
  };
  const audit = { log: jest.fn() };
  return { service: new ServiceOrdersService(prisma as never, audit as never, new DocumentSequenceService()), tx, prisma };
}
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1', code: 'OPI-000001', customerId: 'c1', technicianId: 't1', status: 'ASSIGNED', notes: null, ...over,
});

describe('ServiceOrdersService', () => {
  it('crear sin técnico → REGISTRADA con código OPI-000005; con técnico → ASIGNADA', async () => {
    const { service, tx } = build();
    await service.create({ customerId: 'c1', description: 'Calibrar' } as never, admin);
    expect(tx.serviceOrder.create.mock.calls[0][0].data).toMatchObject({ code: 'OPI-000005', status: 'REGISTERED', technicianId: null });
    await service.create({ customerId: 'c1', description: 'Calibrar', technicianId: 't1' } as never, admin);
    expect(tx.serviceOrder.create.mock.calls[1][0].data.status).toBe('ASSIGNED');
  });

  it('un técnico no puede crear, asignar, facturar ni cancelar', async () => {
    const { service } = build(order());
    await expect(service.create({ customerId: 'c1', description: 'x' } as never, tech)).rejects.toThrow(ForbiddenException);
    await expect(service.assign('o1', { technicianId: 't1' }, tech)).rejects.toThrow(ForbiddenException);
    await expect(service.invoice('o1', { saleId: 's1' }, tech)).rejects.toThrow(ForbiddenException);
    await expect(service.cancel('o1', { reason: 'motivo largo' }, tech)).rejects.toThrow(ForbiddenException);
  });

  it('asignar exige un usuario técnico activo', async () => {
    const { service, tx } = build(order({ status: 'REGISTERED', technicianId: null }));
    tx.user.findUnique.mockResolvedValueOnce({ isActive: true, role: { code: 'SELLER' } });
    await expect(service.assign('o1', { technicianId: 'u9' }, admin)).rejects.toThrow(BadRequestException);
    tx.user.findUnique.mockResolvedValueOnce({ isActive: false, role: { code: 'TECHNICIAN' } });
    await expect(service.assign('o1', { technicianId: 'u9' }, admin)).rejects.toMatchObject({
      response: { errors: [{ field: 'technicianId', message: 'El técnico está inactivo' }] },
    });
  });

  it('iniciar: ASIGNADA → EN PROCESO registra startedAt', async () => {
    const { service, tx } = build(order());
    await service.start('o1', tech);
    expect(tx.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'IN_PROGRESS', startedAt: expect.any(Date) });
  });

  it('completar: EN PROCESO → COMPLETADA registra finishedAt y agrega el resumen', async () => {
    const { service, tx } = build(order({ status: 'IN_PROGRESS', notes: 'previo' }));
    await service.complete('o1', { summary: 'Listo' }, tech);
    const data = tx.serviceOrder.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'COMPLETED', finishedAt: expect.any(Date) });
    expect(data.notes).toBe('previo\nTrabajo realizado: Listo');
  });

  it('no se puede saltar etapas: iniciar una REGISTRADA o completar una ASIGNADA → 409', async () => {
    await expect(build(order({ status: 'REGISTERED', technicianId: null })).service.start('o1', admin)).rejects.toThrow(ConflictException);
    await expect(build(order({ status: 'ASSIGNED' })).service.complete('o1', {}, admin)).rejects.toThrow(ConflictException);
  });

  it('un técnico no ve ni avanza órdenes ajenas (404)', async () => {
    const other = order({ technicianId: 'otro' });
    await expect(build(other).service.findOne('o1', tech)).rejects.toThrow(NotFoundException);
    await expect(build(other).service.start('o1', tech)).rejects.toThrow(NotFoundException);
  });

  it('el listado de un técnico se fuerza a sus órdenes aunque pida otro técnico', async () => {
    const { service, tx } = build();
    tx.serviceOrder.count = jest.fn().mockResolvedValue(0);
    tx.serviceOrder.findMany = jest.fn().mockResolvedValue([]);
    await service.findAll({ page: 1, limit: 20, technicianId: 'otro' } as never, tech);
    expect(tx.serviceOrder.findMany.mock.calls[0][0].where.technicianId).toBe('t1');
  });

  it('facturar: la venta debe estar vigente y ser del mismo cliente', async () => {
    const completed = order({ status: 'COMPLETED' });
    const a = build(completed);
    a.tx.sale.findUnique.mockResolvedValue({ customerId: 'otro', status: 'ACTIVE' });
    await expect(a.service.invoice('o1', { saleId: 's1' }, admin)).rejects.toMatchObject({
      response: { errors: [{ field: 'saleId', message: 'La venta pertenece a otro cliente' }] },
    });
    const b = build(completed);
    b.tx.sale.findUnique.mockResolvedValue({ customerId: 'c1', status: 'VOIDED' });
    await expect(b.service.invoice('o1', { saleId: 's1' }, admin)).rejects.toMatchObject({
      response: { errors: [{ field: 'saleId', message: 'La venta está anulada' }] },
    });
    const c = build(completed);
    await c.service.invoice('o1', { saleId: 's1' }, admin);
    expect(c.tx.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'INVOICED', saleId: 's1' });
  });

  it('cancelar: registra el motivo en las notas; no aplica a una FACTURADA', async () => {
    const { service, tx } = build(order());
    await service.cancel('o1', { reason: 'Cliente desistió' }, admin);
    expect(tx.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', notes: 'Cancelada: Cliente desistió' });
    await expect(build(order({ status: 'INVOICED' })).service.cancel('o1', { reason: 'Cliente desistió' }, admin)).rejects.toThrow(ConflictException);
  });
});
