import { PurchaseStatus } from '../generated/prisma/client';
import { landedUnitCost, purchaseLineSubtotal } from './landed-cost';
import { canMovePurchase, canReceive } from './purchase-status';
import { planRestock } from './restock.service';

describe('Costo puesto en bodega (landedUnitCost)', () => {
  it('en córdobas y sin gastos es el mismo costo', () => {
    expect(landedUnitCost({ unitCost: 950.5, subtotal: 9505, totalUnits: 10, additionalCosts: 0, exchangeRate: 1 }).toNumber()).toBe(950.5);
  });

  it('reparte los gastos por valor y convierte con el tipo de cambio', () => {
    // 26.5 + 26.5 × 50 / 445 = 29.477528… × 36.6243 = 1079.5938
    const c = landedUnitCost({ unitCost: 26.5, subtotal: 445, totalUnits: 16, additionalCosts: 50, exchangeRate: 36.6243 });
    expect(c.toNumber()).toBe(1079.5938);
  });

  it('la suma de lo prorrateado coincide con los gastos', () => {
    const lines = [
      { q: 10, c: 26.5 },
      { q: 6, c: 30 },
    ];
    const subtotal = lines.reduce((a, l) => a + l.q * l.c, 0);
    const extra = lines.reduce(
      (a, l) => a + l.q * (landedUnitCost({ unitCost: l.c, subtotal, totalUnits: 16, additionalCosts: 50, exchangeRate: 1 }).toNumber() - l.c),
      0,
    );
    expect(extra).toBeCloseTo(50, 2);
  });

  it('si la compra vale 0, los gastos se reparten por unidad', () => {
    expect(landedUnitCost({ unitCost: 0, subtotal: 0, totalUnits: 4, additionalCosts: 100, exchangeRate: 1 }).toNumber()).toBe(25);
  });

  it('subtotal de línea redondeado a 2 decimales (igual que el CHECK)', () => {
    expect(purchaseLineSubtotal(3, '10.3333').toFixed(2)).toBe('31.00');
  });
});

describe('Estados de la compra', () => {
  it('solo se recibe lo ordenado o parcialmente recibido', () => {
    expect(canReceive(PurchaseStatus.DRAFT)).toBe(false);
    expect(canReceive(PurchaseStatus.ORDERED)).toBe(true);
    expect(canReceive(PurchaseStatus.PARTIALLY_RECEIVED)).toBe(true);
    expect(canReceive(PurchaseStatus.RECEIVED)).toBe(false);
  });

  it('recibida y cancelada son estados finales', () => {
    expect(canMovePurchase(PurchaseStatus.RECEIVED, PurchaseStatus.CANCELLED)).toBe(false);
    expect(canMovePurchase(PurchaseStatus.CANCELLED, PurchaseStatus.ORDERED)).toBe(false);
    expect(canMovePurchase(PurchaseStatus.PARTIALLY_RECEIVED, PurchaseStatus.CANCELLED)).toBe(true);
  });
});

describe('Sugerencia de reabastecimiento (planRestock)', () => {
  it('con máximo definido lleva el stock al máximo', () => {
    const p = planRestock({ stock: 3, minStock: 5, maxStock: 20, soldRecently: 0, incoming: 0 });
    expect(p).toMatchObject({ rule: 'MAX_STOCK', target: 20, suggestedQuantity: 17 });
  });

  it('sin máximo: 2 × mínimo, o mínimo + demanda si se vende más', () => {
    expect(planRestock({ stock: 2, minStock: 8, maxStock: null, soldRecently: 3, incoming: 0 })).toMatchObject({
      rule: 'TWICE_MIN',
      suggestedQuantity: 14,
    });
    expect(planRestock({ stock: 2, minStock: 8, maxStock: null, soldRecently: 20, incoming: 0 })).toMatchObject({
      rule: 'MIN_PLUS_DEMAND',
      target: 28,
      suggestedQuantity: 26,
    });
  });

  it('descuenta lo que ya viene en compras ordenadas', () => {
    const p = planRestock({ stock: 2, minStock: 8, maxStock: 10, soldRecently: 0, incoming: 8 });
    expect(p).toMatchObject({ suggestedQuantity: 0, coveredByIncoming: true });
    expect(p.explanation).toContain('en camino 8');
  });

  it('sin mínimo ni máximo pide definir la regla', () => {
    expect(planRestock({ stock: 0, minStock: 0, maxStock: null, soldRecently: 0, incoming: 0 })).toMatchObject({
      needsRule: true,
      suggestedQuantity: 0,
    });
  });
});
