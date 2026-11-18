import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';

type P = { id: string; sku: string; name: string; stock: number; avgCost: string; byLocation?: Record<number, number> };

/** Existencias por ubicación en memoria: por defecto todo el stock está en la bodega (1). */
function stockMock(products: P[]) {
  const rows = products.flatMap((p) =>
    Object.entries(p.byLocation ?? { 1: p.stock }).map(([loc, quantity]) => ({ productId: p.id, locationId: Number(loc), quantity })),
  );
  return {
    rows,
    productStock: {
      findMany: jest.fn(({ where }) => Promise.resolve(rows.filter((r) => where.productId.in.includes(r.productId)).map((r) => ({ ...r })))),
      update: jest.fn(({ where, data }) => {
        const k = where.productId_locationId;
        const row = rows.find((r) => r.productId === k.productId && r.locationId === k.locationId)!;
        row.quantity += data.quantity.increment;
        return Promise.resolve(row);
      }),
      create: jest.fn(({ data }) => {
        rows.push({ ...data });
        return Promise.resolve(data);
      }),
    },
  };
}

const qtyAt = (rows: { productId: string; locationId: number; quantity: number }[], id: string, loc: number) =>
  rows.find((r) => r.productId === id && r.locationId === loc)?.quantity ?? 0;

function buildTx(products: P[]) {
  const db = new Map(products.map((p) => [p.id, { ...p }]));
  const stocks = stockMock(products);
  const tx = {
    productStock: stocks.productStock,
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
  return { tx, db, rows: stocks.rows };
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

  it('venta: toma primero de la sucursal y el resto de la bodega (un movimiento por ubicación)', async () => {
    const { tx, db, rows } = buildTx([p({ stock: 10, byLocation: { 1: 8, 2: 2 } })]);
    const [res] = await service.registerExits(tx as never, [{ productId: 'p1', quantity: 5 }], { ...ctx, locationId: 2 }, 'items', [2, 1]);
    expect(db.get('p1')!.stock).toBe(5);
    expect(qtyAt(rows, 'p1', 2)).toBe(0);
    expect(qtyAt(rows, 'p1', 1)).toBe(5);
    expect(res.parts).toHaveLength(2);
    const data = tx.inventoryMovement.create.mock.calls.map((c) => c[0].data);
    expect(data).toEqual([
      expect.objectContaining({ type: 'EXIT', quantity: 2, locationId: 2, stockBefore: 10, stockAfter: 8 }),
      expect.objectContaining({ type: 'EXIT', quantity: 3, locationId: 1, stockBefore: 8, stockAfter: 5 }),
    ]);
  });

  it('salida de una ubicación sin existencia suficiente → 409 aunque el total alcance', async () => {
    const { tx } = buildTx([p({ stock: 10, byLocation: { 1: 9, 2: 1 } })]);
    const err = await service.registerExit(tx as never, { productId: 'p1', quantity: 3, ...ctx, locationId: 2 }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse().errors[0].message).toBe('Stock insuficiente de SKU-1 en Sucursal principal: disponible 1, solicitado 3');
  });

  it('ajuste por conteo en la sucursal: cambia esa ubicación y el total en la diferencia', async () => {
    const { tx, db, rows } = buildTx([p({ stock: 10, byLocation: { 1: 8, 2: 2 } })]);
    const res = await service.registerAdjustment(tx as never, { productId: 'p1', newStock: 5, ...ctx, locationId: 2 });
    expect(res.movement).toMatchObject({ type: 'ADJUSTMENT', quantity: 3, stockBefore: 10, stockAfter: 13, locationId: 2 });
    expect(db.get('p1')!.stock).toBe(13);
    expect(qtyAt(rows, 'p1', 2)).toBe(5);
    expect(qtyAt(rows, 'p1', 1)).toBe(8);
  });

  it('traslado: salida en el origen y entrada en el destino; total y costo promedio sin cambio', async () => {
    const { tx, db, rows } = buildTx([p({ stock: 10, avgCost: '123.4567', byLocation: { 1: 10 } })]);
    const res = await service.transfer(tx as never, { fromLocationId: 1, toLocationId: 2, lines: [{ productId: 'p1', quantity: 4 }], ...ctx, transferId: 't1' });
    expect(db.get('p1')).toMatchObject({ stock: 10, avgCost: '123.4567' });
    expect(qtyAt(rows, 'p1', 1)).toBe(6);
    expect(qtyAt(rows, 'p1', 2)).toBe(4);
    expect(res.exits[0].movement).toMatchObject({ type: 'EXIT', locationId: 1, transferId: 't1' });
    expect(res.entries[0].movement).toMatchObject({ type: 'ENTRY', locationId: 2, transferId: 't1', unitCost: '123.4567' });
  });

  it('traslado con más de lo que hay en el origen → 409; mismo origen y destino → 400', async () => {
    const { tx } = buildTx([p({ stock: 10, byLocation: { 1: 3, 2: 7 } })]);
    await expect(service.transfer(tx as never, { fromLocationId: 1, toLocationId: 2, lines: [{ productId: 'p1', quantity: 4 }], ...ctx })).rejects.toThrow(ConflictException);
    await expect(service.transfer(tx as never, { fromLocationId: 2, toLocationId: 2, lines: [{ productId: 'p1', quantity: 1 }], ...ctx })).rejects.toThrow(BadRequestException);
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
