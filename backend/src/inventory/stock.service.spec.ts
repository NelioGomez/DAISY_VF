import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';

type P = { id: string; sku: string; name: string; stock: number; avgCost: string };

function buildTx(products: P[]) {
  const db = new Map(products.map((p) => [p.id, { ...p }]));
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    product: {
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          [...db.values()]
            .filter((p) => where.id.in.includes(p.id))
            .map((p) => ({ ...p, avgCost: { toString: () => p.avgCost } })),
        ),
      ),
      update: jest.fn(({ where, data }) => {
        const p = db.get(where.id)!;
        p.stock = data.stock;
        p.avgCost = data.avgCost;
        return Promise.resolve(p);
      }),
    },
    inventoryMovement: {
      create: jest.fn(({ data }) => Promise.resolve({ id: `m-${Math.random()}`, createdAt: new Date(), ...data })),
    },
  };
  return { tx, db };
}

const ctx = { userId: 'u1', reference: 'REF' };
const p = (over: Partial<P> = {}): P => ({ id: 'p1', sku: 'SKU-1', name: 'Boquilla', stock: 10, avgCost: '100.0000', ...over });

describe('StockService', () => {
  const service = new StockService();

  it('entrada: suma stock, recalcula costo promedio y bloquea la fila', async () => {
    const { tx, db } = buildTx([p()]);
    const res = await service.registerEntry(tx as never, { productId: 'p1', quantity: 10, unitCost: 200, ...ctx });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(db.get('p1')).toMatchObject({ stock: 20, avgCost: '150.0000' });
    expect(res.movement).toMatchObject({ type: 'ENTRY', quantity: 10, stockBefore: 10, stockAfter: 20, unitCost: '200.0000' });
  });

  it('salida: descuenta al costo promedio y NO lo modifica', async () => {
    const { tx, db } = buildTx([p()]);
    const res = await service.registerExit(tx as never, { productId: 'p1', quantity: 4, ...ctx });
    expect(db.get('p1')).toMatchObject({ stock: 6, avgCost: '100.0000' });
    expect(res.movement).toMatchObject({ type: 'EXIT', unitCost: '100.0000', stockBefore: 10, stockAfter: 6 });
  });

  it('salida con stock insuficiente → 409 con la línea afectada y sin cambios', async () => {
    const { tx, db } = buildTx([p({ stock: 2 })]);
    const err = await service.registerExit(tx as never, { productId: 'p1', quantity: 3, ...ctx }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors[0]).toMatchObject({ field: 'items[0].quantity' });
    expect(err.getResponse().errors[0].message).toContain('disponible 2, solicitado 3');
    expect(db.get('p1')!.stock).toBe(2);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('salidas múltiples: valida TODAS antes de mover algo (todo o nada)', async () => {
    const { tx, db } = buildTx([p({ id: 'a', sku: 'A', stock: 5 }), p({ id: 'b', sku: 'B', stock: 1 })]);
    const err = await service
      .registerExits(tx as never, [{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 9 }], ctx)
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors).toHaveLength(1);
    expect(err.getResponse().errors[0].field).toBe('items[1].quantity');
    expect(db.get('a')!.stock).toBe(5);
  });

  it('bloquea los productos en orden de id (previene interbloqueos)', async () => {
    const { tx } = buildTx([p({ id: 'b' }), p({ id: 'a' })]);
    await service.registerExits(tx as never, [{ productId: 'b', quantity: 1 }, { productId: 'a', quantity: 1 }], ctx);
    const order = tx.product.findMany.mock.calls[0][0].where.id.in;
    expect(order).toEqual(['a', 'b']);
  });

  it('ajuste: fija el stock contado; la cantidad es la diferencia absoluta', async () => {
    const { tx, db } = buildTx([p()]);
    const res = await service.registerAdjustment(tx as never, { productId: 'p1', newStock: 7, ...ctx });
    expect(db.get('p1')).toMatchObject({ stock: 7, avgCost: '100.0000' });
    expect(res.movement).toMatchObject({ type: 'ADJUSTMENT', quantity: 3, stockBefore: 10, stockAfter: 7 });
  });

  it('ajuste que no cambia nada o inválido → 400', async () => {
    const { tx } = buildTx([p()]);
    await expect(service.registerAdjustment(tx as never, { productId: 'p1', newStock: 10, ...ctx })).rejects.toThrow(BadRequestException);
    await expect(service.registerAdjustment(tx as never, { productId: 'p1', newStock: -1, ...ctx })).rejects.toThrow(BadRequestException);
    await expect(service.registerAdjustment(tx as never, { productId: 'p1', newStock: 1.5, ...ctx })).rejects.toThrow(BadRequestException);
  });

  it('producto inexistente → 404 (entrada/ajuste)', async () => {
    const { tx } = buildTx([]);
    await expect(service.registerEntry(tx as never, { productId: 'x', quantity: 1, unitCost: 1, ...ctx })).rejects.toThrow(NotFoundException);
  });

  it('cantidad cero o decimal → 400', async () => {
    const { tx } = buildTx([p()]);
    await expect(service.registerExit(tx as never, { productId: 'p1', quantity: 0, ...ctx })).rejects.toThrow(BadRequestException);
    await expect(service.registerEntry(tx as never, { productId: 'p1', quantity: 1.5, unitCost: 1, ...ctx })).rejects.toThrow(BadRequestException);
  });
});
