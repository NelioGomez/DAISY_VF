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

  describe('garantía (mejora n.° 60)', () => {
    const DAY = 86_400_000;
    const item = (daysAgo: number, warrantyDays: number | null, over: Record<string, unknown> = {}) => ({
      sale: { customerId: 'c1', status: 'ACTIVE', invoiceNumber: 'FAC-000010', soldAt: new Date(Date.now() - daysAgo * DAY), ...over },
      product: { name: 'Bomba sumergible', warrantyDays },
    });
    const bySale = { customerId: 'c1', description: 'No enciende', underWarranty: true, warrantySaleId: 's1', warrantyProductId: 'p1' };

    it('por compra vigente: guarda la venta y el producto que la cubren', async () => {
      const { service, tx } = build();
      tx.saleItem = { findUnique: jest.fn().mockResolvedValue(item(10, 30)) };
      await service.create(bySale as never, admin);
      expect(tx.serviceOrder.create.mock.calls[0][0].data).toMatchObject({
        underWarranty: true, warrantySaleId: 's1', warrantyProductId: 'p1', warrantyOrderId: null,
      });
    });

    it('por compra: vencida, sin garantía, de otro cliente o anulada → 400', async () => {
      const cases: Array<[ReturnType<typeof item> | null, string, RegExp]> = [
        [item(40, 30), 'warrantyProductId', /venció el/],
        [item(5, null), 'warrantyProductId', /no tiene garantía/],
        [item(5, 30, { customerId: 'otro' }), 'warrantySaleId', /otro cliente/],
        [item(5, 30, { status: 'VOIDED' }), 'warrantySaleId', /anulada/],
        [null, 'warrantyProductId', /no está en la venta/],
      ];
      for (const [row, field, msg] of cases) {
        const { service, tx } = build();
        tx.saleItem = { findUnique: jest.fn().mockResolvedValue(row) };
        await expect(service.create(bySale as never, admin)).rejects.toMatchObject({ response: { errors: [{ field, message: expect.stringMatching(msg) }] } });
        expect(tx.serviceOrder.create).not.toHaveBeenCalled();
      }
    });

    it('exige indicar una sola fuente, y solo si la orden está en garantía', async () => {
      const { service } = build();
      await expect(service.create({ customerId: 'c1', description: 'x', underWarranty: true } as never, admin)).rejects.toThrow(BadRequestException);
      await expect(service.create({ ...bySale, warrantyOrderId: 'o0' } as never, admin)).rejects.toThrow(BadRequestException);
      await expect(service.create({ customerId: 'c1', description: 'x', warrantyOrderId: 'o0' } as never, admin)).rejects.toMatchObject({
        response: { errors: [{ field: 'underWarranty' }] },
      });
    });

    it('por un servicio anterior: su garantía de trabajo debe seguir vigente', async () => {
      const prev = (until: number | null, over: Record<string, unknown> = {}) => ({
        customerId: 'c1', code: 'OPI-000001', status: 'INVOICED', warrantyUntil: until === null ? null : new Date(Date.now() + until * DAY), ...over,
      });
      const dto = { customerId: 'c1', description: 'Volvió a fallar', underWarranty: true, warrantyOrderId: 'o0' };
      const ok = build();
      ok.tx.serviceOrder.findUnique.mockResolvedValueOnce(prev(20));
      await ok.service.create(dto as never, admin);
      expect(ok.tx.serviceOrder.create.mock.calls[0][0].data).toMatchObject({ underWarranty: true, warrantyOrderId: 'o0', warrantySaleId: null });
      for (const row of [prev(-1), prev(null), prev(20, { customerId: 'otro' }), prev(20, { status: 'CANCELLED' })]) {
        const b = build();
        b.tx.serviceOrder.findUnique.mockResolvedValueOnce(row);
        await expect(b.service.create(dto as never, admin)).rejects.toMatchObject({ response: { errors: [{ field: 'warrantyOrderId' }] } });
      }
    });

    it('al completar fija la garantía del trabajo: 90 días por omisión, 0 = sin garantía', async () => {
      const a = build(order({ status: 'IN_PROGRESS' }));
      await a.service.complete('o1', {}, tech);
      const data = a.tx.serviceOrder.update.mock.calls[0][0].data;
      expect(data.serviceWarrantyDays).toBe(90);
      const days = (data.warrantyUntil.getTime() - Date.now()) / DAY;
      expect(days).toBeGreaterThan(89.9);
      expect(days).toBeLessThan(91.1);
      const b = build(order({ status: 'IN_PROGRESS' }));
      await b.service.complete('o1', { warrantyDays: 0 }, tech);
      expect(b.tx.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ serviceWarrantyDays: 0, warrantyUntil: null });
    });

    it('cancelar una orden completada con costo quita la garantía del trabajo', async () => {
      const b = build(order({ status: 'COMPLETED', serviceWarrantyDays: 90, warrantyUntil: new Date(Date.now() + 30 * DAY) }));
      await b.service.cancel('o1', { reason: 'El cliente no aceptó el trabajo' }, admin);
      expect(b.tx.serviceOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'CANCELLED', serviceWarrantyDays: null, warrantyUntil: null });
    });

    it('una orden en garantía no se factura, y completada queda cerrada', async () => {
      const done = order({ status: 'COMPLETED', underWarranty: true });
      await expect(build(done).service.invoice('o1', { saleId: 's1' }, admin)).rejects.toThrow(/garantía no se factura/);
      await expect(build(done).service.cancel('o1', { reason: 'Cliente desistió' }, admin)).rejects.toThrow(ConflictException);
      await expect(build(done).service.update('o1', { description: 'otra' } as never, admin)).rejects.toThrow(ConflictException);
    });

    it('desde una solicitud de servicio técnico: la deja atendida; una de cotización → 409', async () => {
      const inquiry = (over: Record<string, unknown> = {}) => ({
        id: 'i1', code: 'SOL-000003', status: 'NEW', type: 'SERVICE', customerId: null, serviceOrder: null, ...over,
      });
      const { service, tx } = build();
      tx.webInquiry = { findUnique: jest.fn().mockResolvedValue(inquiry()), update: jest.fn() };
      await service.create({ customerId: 'c1', description: 'Revisar bomba', inquiryId: 'i1' } as never, admin);
      expect(tx.serviceOrder.create.mock.calls[0][0].data.inquiryId).toBe('i1');
      expect(tx.webInquiry.update.mock.calls[0][0].data).toMatchObject({ status: 'CLOSED', customerId: 'c1' });
      for (const [over, msg] of [
        [{ type: 'QUOTE' }, /no es de servicio técnico/],
        [{ status: 'CLOSED', type: 'COMPLAINT' }, /ya fue atendida/],
        [{ customerId: 'otro' }, BadRequestException],
        [{ serviceOrder: { code: 'OPI-000002' } }, /ya tiene la orden OPI-000002/],
      ] as const) {
        const b = build();
        b.tx.webInquiry = { findUnique: jest.fn().mockResolvedValue(inquiry(over)), update: jest.fn() };
        await expect(b.service.create({ customerId: 'c1', description: 'x', inquiryId: 'i1' } as never, admin)).rejects.toThrow(msg);
        expect(b.tx.webInquiry.update).not.toHaveBeenCalled();
      }
    });
  });
});
