import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentLinesService } from '../documents/document-lines.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { TaxService } from '../documents/tax.service';
import { StockService } from '../inventory/stock.service';
import { SalesService } from './sales.service';

const actor = { id: 'seller1', username: 'ana', role: 'SELLER', permissions: [] } as never;
const dec = (v: string | number) => ({ toString: () => String(v) });

interface Prod { id: string; sku: string; name: string; stock: number; avgCost: string; salePrice: string; isActive: boolean }
const prod = (over: Partial<Prod> = {}): Prod => ({
  id: 'p1', sku: 'GIL-1', name: 'Boquilla', stock: 10, avgCost: '60.0000', salePrice: '100.00', isActive: true, ...over,
});

function build(products: Prod[] = [prod()]) {
  const db = new Map(products.map((p) => [p.id, { ...p }]));
  let seq = 0;
  const tx: Record<string, any> = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    systemConfig: { findUnique: jest.fn(({ where }) => Promise.resolve(where.key === 'TAX_RATE' ? { value: '0.15' } : null)) },
    customer: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
    documentSequence: { upsert: jest.fn(() => Promise.resolve({ lastValue: ++seq })) },
    product: {
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          [...db.values()].filter((p) => where.id.in.includes(p.id)).map((p) => ({
            ...p, avgCost: dec(p.avgCost), salePrice: dec(p.salePrice),
          })),
        ),
      ),
      update: jest.fn(({ where, data }) => {
        const p = db.get(where.id)!;
        p.stock = data.stock;
        p.avgCost = data.avgCost;
        return Promise.resolve(p);
      }),
    },
    inventoryMovement: { create: jest.fn(({ data }) => Promise.resolve({ id: 'm', createdAt: new Date(), ...data })) },
    sale: {
      create: jest.fn(({ data }) => Promise.resolve({
        ...data, subtotal: dec(data.subtotal), tax: dec(data.tax), total: dec(data.total), balance: dec(data.balance),
        soldAt: data.soldAt, voidedAt: null, voidReason: null, status: 'ACTIVE',
        items: data.items.create.map((i: any, n: number) => ({ id: `i${n}`, ...i, unitPrice: dec(i.unitPrice), unitCost: dec(i.unitCost), subtotal: dec(i.subtotal), product: { sku: 'GIL-1', name: 'Boquilla' } })),
        payments: (data.payments?.create ?? []).map((p: any, n: number) => ({ id: `pay${n}`, ...p, amount: dec(p.amount) })),
      })),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    quotation: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    sale: tx.sale,
    quotation: tx.quotation,
  };
  const audit = { log: jest.fn() };
  const service = new SalesService(
    prisma as never, audit as never, new StockService(), new TaxService(prisma as never),
    new DocumentSequenceService(), new DocumentLinesService(),
  );
  return { service, tx, prisma, audit, db };
}

describe('SalesService.create (venta directa)', () => {
  it('contado: IVA 15%, descuenta stock al costo promedio, factura FAC-000001 y cobra todo', async () => {
    const { service, tx, db, audit } = build();
    const sale = await service.create(
      { customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 3 }] } as never,
      actor,
    );
    expect(sale).toMatchObject({
      invoiceNumber: 'FAC-000001', subtotal: 300, tax: 45, total: 345, balance: 0, paymentStatus: 'PAID', dueDate: null,
    });
    expect(db.get('p1')!.stock).toBe(7);
    // costo promedio de salida guardado en la línea (para márgenes)
    expect(tx.sale.create.mock.calls[0][0].data.items.create[0].unitCost).toBe('60.0000');
    expect(tx.sale.create.mock.calls[0][0].data.payments.create[0]).toMatchObject({ amount: '345.00', method: 'CASH', userId: 'seller1' });
    expect(tx.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({
      type: 'EXIT', reference: 'FAC-000001', sourceEntity: 'Sale', userId: 'seller1',
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'sales', action: 'CREATE' }));
  });

  it('precio negociado distinto al de lista', async () => {
    const { service } = build();
    const sale = await service.create(
      { customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 2, unitPrice: 80 }] } as never,
      actor,
    );
    expect(sale).toMatchObject({ subtotal: 160, tax: 24, total: 184 });
  });

  it('crédito con abono inicial: PARTIAL, saldo y vencimiento', async () => {
    const { service, tx } = build();
    const sale = await service.create(
      { customerId: 'c1', paymentMethod: 'CREDIT', initialPayment: 100, initialPaymentMethod: 'CASH', creditDays: 30,
        items: [{ productId: 'p1', quantity: 3 }] } as never,
      actor,
    );
    expect(sale).toMatchObject({ total: 345, balance: 245, paymentStatus: 'PARTIAL' });
    expect(sale.dueDate).toBeInstanceOf(Date);
    expect(tx.sale.create.mock.calls[0][0].data.payments.create[0].amount).toBe('100.00');
  });

  it('crédito sin abono: PENDING y sin pagos registrados', async () => {
    const { service, tx } = build();
    const sale = await service.create(
      { customerId: 'c1', paymentMethod: 'CREDIT', items: [{ productId: 'p1', quantity: 1 }] } as never, actor,
    );
    expect(sale).toMatchObject({ balance: 115, paymentStatus: 'PENDING' });
    expect(tx.sale.create.mock.calls[0][0].data.payments).toBeUndefined();
  });

  it('stock insuficiente → 409 y NO se crea la venta ni se mueve inventario', async () => {
    const { service, tx, db } = build([prod({ stock: 2 })]);
    const err = await service.create(
      { customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 5 }] } as never, actor,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors[0].message).toContain('disponible 2, solicitado 5');
    expect(tx.sale.create).not.toHaveBeenCalled();
    expect(db.get('p1')!.stock).toBe(2);
  });

  it('cliente inexistente o inactivo → 400', async () => {
    const { service, tx } = build();
    tx.customer.findUnique.mockResolvedValueOnce(null);
    await expect(service.create({ customerId: 'x', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 1 }] } as never, actor)).rejects.toThrow(BadRequestException);
    tx.customer.findUnique.mockResolvedValueOnce({ isActive: false });
    await expect(service.create({ customerId: 'x', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 1 }] } as never, actor)).rejects.toThrow(BadRequestException);
  });

  it('producto inactivo, repetido o inexistente → 400 con el campo', async () => {
    const { service } = build([prod({ isActive: false })]);
    const err = await service.create({ customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 1 }] } as never, actor).catch((e) => e);
    expect(err.getResponse().errors[0].field).toBe('items[0].productId');
    const dup = await service.create({ customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 1 }] } as never, actor).catch((e) => e);
    expect(dup.getResponse().errors[0].message).toContain('repetido');
  });

  it('total cero → 400 (no se factura gratis)', async () => {
    const { service } = build();
    await expect(
      service.create({ customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 1, unitPrice: 0 }] } as never, actor),
    ).rejects.toThrow(BadRequestException);
  });

  it('dos ventas consecutivas obtienen números consecutivos', async () => {
    const { service } = build();
    const dto = { customerId: 'c1', paymentMethod: 'CASH', items: [{ productId: 'p1', quantity: 1 }] } as never;
    const a = await service.create(dto, actor);
    const b = await service.create(dto, actor);
    expect([a.invoiceNumber, b.invoiceNumber]).toEqual(['FAC-000001', 'FAC-000002']);
  });
});

describe('SalesService.convertQuotation', () => {
  const quotation = (status: string) => ({
    status, code: 'COT-000007', subtotal: dec('300.00'), tax: dec('45.00'), total: dec('345.00'),
    items: [{ productId: 'p1', quantity: 3, unitPrice: dec('100.00'), subtotal: dec('300.00'), product: { sku: 'GIL-1', name: 'Boquilla' } }],
  });
  const terms = { paymentMethod: 'CASH' } as never;

  it('APROBADA → crea la venta con los precios cotizados y marca CONVERTIDA', async () => {
    const { service, tx, prisma } = build();
    prisma.quotation.findUnique.mockResolvedValueOnce({ customerId: 'c1', sellerId: 'seller9' });
    tx.quotation.findUnique.mockResolvedValue(quotation('APPROVED'));
    const sale = await service.convertQuotation('q1', terms, actor);
    expect(sale).toMatchObject({ total: 345 });
    expect(tx.sale.create.mock.calls[0][0].data).toMatchObject({ quotationId: 'q1', sellerId: 'seller9' });
    expect(tx.quotation.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { status: 'CONVERTED' } });
  });

  it('usa el precio cotizado aunque el precio de lista haya cambiado', async () => {
    const { service, tx, prisma } = build([prod({ salePrice: '999.00' })]);
    prisma.quotation.findUnique.mockResolvedValueOnce({ customerId: 'c1', sellerId: 'seller9' });
    tx.quotation.findUnique.mockResolvedValue(quotation('APPROVED'));
    const sale = await service.convertQuotation('q1', terms, actor);
    expect(sale.total).toBe(345);
  });

  it.each(['PENDING', 'DRAFT', 'REJECTED'])('estado %s → 409 (solo APROBADA se convierte)', async (status) => {
    const { service, tx, prisma } = build();
    prisma.quotation.findUnique.mockResolvedValueOnce({ customerId: 'c1', sellerId: 's' });
    tx.quotation.findUnique.mockResolvedValue(quotation(status));
    await expect(service.convertQuotation('q1', terms, actor)).rejects.toThrow(ConflictException);
    expect(tx.sale.create).not.toHaveBeenCalled();
  });

  it('ya convertida → 409; vencida → 409', async () => {
    const { service, tx, prisma } = build();
    prisma.quotation.findUnique.mockResolvedValueOnce({ customerId: 'c1', sellerId: 's' });
    tx.quotation.findUnique.mockResolvedValue(quotation('CONVERTED'));
    await expect(service.convertQuotation('q1', terms, actor)).rejects.toThrow('ya fue convertida');
    tx.quotation.findUnique.mockResolvedValue(quotation('EXPIRED'));
    await expect(service.convertQuotation('q1', terms, actor)).rejects.toThrow('vencida');
  });

  it('carrera: la restricción única de quotationId se traduce en 409', async () => {
    const { service, tx, prisma } = build();
    prisma.quotation.findUnique.mockResolvedValueOnce({ customerId: 'c1', sellerId: 's' });
    tx.quotation.findUnique.mockResolvedValue(quotation('APPROVED'));
    tx.sale.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(service.convertQuotation('q1', terms, actor)).rejects.toThrow('ya fue convertida');
  });

  it('cotización inexistente → 404', async () => {
    const { service, prisma } = build();
    prisma.quotation.findUnique.mockResolvedValueOnce(null);
    await expect(service.convertQuotation('q1', terms, actor)).rejects.toThrow(NotFoundException);
  });

  it('sin stock al convertir → 409 y la cotización sigue APROBADA', async () => {
    const { service, tx, prisma } = build([prod({ stock: 1 })]);
    prisma.quotation.findUnique.mockResolvedValueOnce({ customerId: 'c1', sellerId: 's' });
    tx.quotation.findUnique.mockResolvedValue(quotation('APPROVED'));
    await expect(service.convertQuotation('q1', terms, actor)).rejects.toThrow(ConflictException);
    expect(tx.quotation.update).not.toHaveBeenCalled();
  });
});

describe('SalesService.voidSale', () => {
  const saleRow = (over: Record<string, unknown> = {}) => ({
    invoiceNumber: 'FAC-000001', status: 'ACTIVE',
    items: [{ productId: 'p1', quantity: 3, unitCost: dec('60.0000') }],
    payments: [{ amount: dec('100.00') }, { amount: dec('50.50') }],
    _count: { serviceOrders: 0 },
    ...over,
  });

  it('devuelve el stock con una ENTRADA al costo de venta, deja saldo 0 y reporta lo cobrado', async () => {
    const { service, tx, db } = build([prod({ stock: 7 })]);
    tx.sale.findUnique.mockResolvedValueOnce(saleRow()).mockResolvedValueOnce({
      id: 's1', invoiceNumber: 'FAC-000001', subtotal: dec(1), tax: dec(0), total: dec(1), balance: dec(0),
      soldAt: new Date(), status: 'VOIDED', items: [], payments: [], paymentMethod: 'CASH', paymentStatus: 'PAID',
    });
    const res = await service.voidSale('s1', { reason: 'Error de digitación' }, actor);
    expect(db.get('p1')!.stock).toBe(10);
    expect(tx.inventoryMovement.create.mock.calls[0][0].data).toMatchObject({
      type: 'ENTRY', sourceEntity: 'SaleVoid', sourceId: 's1', quantity: 3, unitCost: '60.0000',
    });
    expect(tx.sale.update.mock.calls[0][0].data).toMatchObject({ status: 'VOIDED', balance: '0.00', voidReason: 'Error de digitación' });
    expect(res.refundDue).toBe(150.5);
  });

  it('venta ya anulada → 409; con órdenes de servicio → 409; inexistente → 404', async () => {
    const { service, tx } = build();
    tx.sale.findUnique.mockResolvedValueOnce(saleRow({ status: 'VOIDED' }));
    await expect(service.voidSale('s1', { reason: 'xxxxx' }, actor)).rejects.toThrow('ya está anulada');
    tx.sale.findUnique.mockResolvedValueOnce(saleRow({ _count: { serviceOrders: 1 } }));
    await expect(service.voidSale('s1', { reason: 'xxxxx' }, actor)).rejects.toThrow('órdenes de servicio');
    tx.sale.findUnique.mockResolvedValueOnce(null);
    await expect(service.voidSale('s1', { reason: 'xxxxx' }, actor)).rejects.toThrow(NotFoundException);
  });
});