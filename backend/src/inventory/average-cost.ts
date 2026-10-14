import { cost4, Decimal } from '../common/utils/money';

/**
 * Costo promedio ponderado tras una entrada:
 *   (stock × costoActual + cantidad × costoEntrada) / (stock + cantidad)
 * Las salidas y ajustes NO cambian el costo promedio.
 */
export function weightedAverageCost(
  stock: number,
  avgCost: Decimal.Value,
  quantity: number,
  unitCost: Decimal.Value,
): Decimal {
  const total = stock + quantity;
  if (total <= 0) return cost4(unitCost);
  const value = new Decimal(avgCost).times(stock).plus(new Decimal(unitCost).times(quantity));
  return cost4(value.dividedBy(total));
}
