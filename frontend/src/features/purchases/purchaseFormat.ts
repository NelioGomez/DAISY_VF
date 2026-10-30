import type { Moneda } from '../../types';

/** Monto en la moneda de la compra: C$ 1,234.50 o US$ 1,234.50. */
export const moneyIn = (n: number, moneda: Moneda, decimals = 2): string =>
  `${moneda === 'USD' ? 'US$' : 'C$'} ${(n || 0).toLocaleString('es-NI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

/** Costo unitario con hasta 4 decimales (los costos se guardan con 4). */
export const costIn = (n: number, moneda: Moneda): string =>
  `${moneda === 'USD' ? 'US$' : 'C$'} ${(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

/** Costo promedio que quedará tras una entrada (misma fórmula que el servidor). */
export function nextAverageCost(stock: number, avg: number, qty: number, unitCost: number): number {
  const total = stock + qty;
  if (total <= 0) return unitCost;
  return Math.round(((stock * avg + qty * unitCost) / total) * 10000) / 10000;
}
