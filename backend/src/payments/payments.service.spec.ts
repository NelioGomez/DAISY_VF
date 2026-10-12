import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

const actor = { id: 'acc1', username: 'contador', role: 'ACCOUNTING', permissions: [] } as never;
const dec = (v: string | number) => ({ toString: () => String(v) });

function build(sale: { total: string; balance: string; status?: string } | null, alreadyPaid = '0') {
  const tx: Record<string, any> = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    sale: {
      findUnique: jest.fn().mockResolvedValue(
        sale && { invoiceNumber: 'FAC-000009', status: sale.status ?? 'ACTIVE', total: dec(sale.total), balance: dec(sale.balance) },
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      create: jest.fn(({ data }) => Promise.resolve({ id: 'pay1', paidAt: new Date(), ...data, amount: dec(data.amount) })),
      // suma de pagos tras insertar el nuevo
      aggregate: jest.fn(({ }) => Promise.resolve({ _sum: { amount: dec(alreadyPaid) } })),
    },
  };
  const prisma = { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };
  const audit = { log: jest.fn() };
  return { service: new PaymentsService(prisma as never, audit as never), tx, audit };
}

describe('PaymentsService.create', () => {
  it('abono parcial → PARTIAL con saldo = total − pagos', async () => {
    const { service, tx, audit } = build({ total: '1000.00', balance: '1000.00' }, '400.00');
    const res = await service.create({ saleId: 's1', amount: 400, method: 'CASH' } as never, actor);
    expect(res.sale).toMatchObject({ balance: 600, paymentStatus: 'PARTIAL', invoiceNumber: 'FAC-000009' });
    expect(tx.sale.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { balance: '600.00', paymentStatus: 'PARTIAL' } });
    expect(tx.$queryRaw).toHaveBeenCalled(); // bloqueo de la venta
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ module: 'payments', action: 'CREATE' }));
  });

  it('abono que liquida → PAID y saldo 0', async () => {
    const { service } = build({ total: '1000.00', balance: '600.00' }, '1000.00');
    const res = await service.create({ saleId: 's1', amount: 600, method: 'CASH' } as never, actor);
    expect(res.sale).toMatchObject({ balance: 0, paymentStatus: 'PAID' });
  });

  it('abono mayor al saldo → 409 con el saldo en el mensaje y sin escribir', async () => {
    const { service, tx } = build({ total: '1000.00', balance: '300.00' });
    const err = await service.create({ saleId: 's1', amount: 300.01, method: 'CASH' } as never, actor).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors[0]).toEqual({ field: 'amount', message: 'El saldo pendiente es C$ 300.00' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('venta saldada, anulada o inexistente', async () => {
    await expect(build({ total: '10.00', balance: '0.00' }).service.create({ saleId: 's', amount: 1, method: 'CASH' } as never, actor)).rejects.toThrow('saldada');
    await expect(build({ total: '10.00', balance: '5.00', status: 'VOIDED' }).service.create({ saleId: 's', amount: 1, method: 'CASH' } as never, actor)).rejects.toThrow('anulada');
    await expect(build(null).service.create({ saleId: 's', amount: 1, method: 'CASH' } as never, actor)).rejects.toThrow(NotFoundException);
  });

  it('transferencia sin referencia → 400', async () => {
    const { service } = build({ total: '10.00', balance: '5.00' });
    await expect(service.create({ saleId: 's', amount: 1, method: 'TRANSFER' } as never, actor)).rejects.toThrow(BadRequestException);
  });
});