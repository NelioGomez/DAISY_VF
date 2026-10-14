import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentLinesService } from '../documents/document-lines.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { TaxService } from '../documents/tax.service';
import { QuotationsService } from './quotations.service';

const actor = { id: 'seller1', username: 'ana', role: 'SELLER', permissions: [] } as never;
const dec = (v: string | number) => ({ toString: () => String(v) });
const FUTURE = new Date(Date.now() + 5 * 86_400_000);

function build(existing: { status: string; validUntil?: Date } | null = null) {
  const tx: Record<string, any> = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    systemConfig: { findUnique: jest.fn().mockResolvedValue({ value: '0.15' }) },
    customer: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    documentSequence: { upsert: jest.fn().mockResolvedValue({ lastValue: 12 }) },
    product: {
      findMany: jest.fn().mockResolvedValue([{ id: 'p1', sku: 'S', name: 'N', salePrice: dec('200.00'), isActive: true }]),
    },
    quotationItem: { deleteMany: jest.fn().mockResolvedValue({}) },
    quotation: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(existing && { validUntil: FUTURE, ...existing }),
      create: jest.fn(({ data }) => Promise.resolve({
        id: 'q1', ...data, issuedAt: new Date(),
        subtotal: dec(data.subtotal), tax: dec(data.tax), total: dec(data.total),
        items: data.items.create.map((i: any) => ({ id: 'i', ...i, unitPrice: dec(i.unitPrice), subtotal: dec(i.subtotal), product: { sku: 'S', name: 'N', stock: 5 } })),
      })),
      update: jest.fn(({ data: { items: _items, ...data } }) => Promise.resolve({
        id: 'q1', code: 'COT-000012', status: 'PENDING', ...data,
        subtotal: dec(0), tax: dec(0), total: dec(0), issuedAt: new Date(), validUntil: FUTURE,
      })),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: any) => (typeof fn === 'function' ? fn(tx) : Promise.all(fn))) };
  const audit = { log: jest.fn() };
  const service = new QuotationsService(prisma as never, audit as never, new TaxService(prisma as never), new DocumentSequenceService(), new DocumentLinesService());
  return { service, tx, audit };
}

describe('QuotationsService', () => {
  it('crea PENDIENTE con COT-000012, totales con IVA y vendedor = usuario', async () => {
    const { service, tx } = build();
    const q = await service.create({ customerId: 'c1', items: [{ productId: 'p1', quantity: 2 }] } as never, actor);
    expect(q).toMatchObject({ code: 'COT-000012', status: 'PENDING', subtotal: 400, tax: 60, total: 460 });
    expect(tx.quotation.create.mock.calls[0][0].data).toMatchObject({ sellerId: 'seller1' });
    expect(q.validUntil).toBeInstanceOf(Date);
  });

  it('asDraft → BORRADOR', async () => {
    const { service } = build();
    const q = await service.create({ customerId: 'c1', asDraft: true, items: [{ productId: 'p1', quantity: 1 }] } as never, actor);
    expect(q.status).toBe('DRAFT');
  });

  it('aprobar una PENDIENTE; aprobar un BORRADOR → 409', async () => {
    const ok = build({ status: 'PENDING' });
    await ok.service.approve('q1', actor);
    expect(ok.tx.quotation.update.mock.calls[0][0].data).toEqual({ status: 'APPROVED' });
    await expect(build({ status: 'DRAFT' }).service.approve('q1', actor)).rejects.toThrow(ConflictException);
  });

  it('enviar solo desde BORRADOR', async () => {
    await expect(build({ status: 'PENDING' }).service.submit('q1', actor)).rejects.toThrow(ConflictException);
    const ok = build({ status: 'DRAFT' });
    await ok.service.submit('q1', actor);
    expect(ok.tx.quotation.update.mock.calls[0][0].data).toEqual({ status: 'PENDING' });
  });

  it('rechazar desde APROBADA; una CONVERTIDA ya no cambia', async () => {
    await build({ status: 'APPROVED' }).service.reject('q1', 'Precio alto', actor);
    await expect(build({ status: 'CONVERTED' }).service.reject('q1', undefined, actor)).rejects.toThrow(ConflictException);
  });

  it('editar: solo BORRADOR/PENDIENTE; reemplaza líneas y recalcula', async () => {
    await expect(build({ status: 'APPROVED' }).service.update('q1', { notes: 'x' }, actor)).rejects.toThrow('ya no se puede modificar');
    const ok = build({ status: 'PENDING' });
    await ok.service.update('q1', { items: [{ productId: 'p1', quantity: 3 }] }, actor);
    expect(ok.tx.quotationItem.deleteMany).toHaveBeenCalledWith({ where: { quotationId: 'q1' } });
    expect(ok.tx.quotation.update.mock.calls[0][0].data).toMatchObject({ subtotal: '600.00', tax: '90.00', total: '690.00' });
  });

  it('editar una cotización vencida → 409', async () => {
    const past = build({ status: 'PENDING', validUntil: new Date(Date.now() - 1000) });
    await expect(past.service.update('q1', { notes: 'x' }, actor)).rejects.toThrow('vencida');
  });

  it('eliminar solo borradores', async () => {
    await expect(build({ status: 'PENDING' }).service.remove('q1', actor)).rejects.toThrow(ConflictException);
    await expect(build(null).service.remove('q1', actor)).rejects.toThrow(NotFoundException);
    const ok = build({ status: 'DRAFT' });
    await ok.service.remove('q1', actor);
    expect(ok.tx.quotation.delete).toHaveBeenCalled();
  });

  it('el listado/transiciones marcan antes las vencidas (lazy expiry)', async () => {
    const { service, tx } = build({ status: 'PENDING' });
    await service.approve('q1', actor);
    expect(tx.quotation.updateMany).toHaveBeenCalled();
    expect(tx.quotation.updateMany.mock.calls[0][0].data).toEqual({ status: 'EXPIRED' });
  });
});
