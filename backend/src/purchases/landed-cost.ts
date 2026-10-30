import { cost4, Decimal, money } from '../common/utils/money';

export interface LandedCostInput {
  /** Costo unitario de la línea, en la moneda de la compra. */
  unitCost: Decimal.Value;
  /** Subtotal de toda la compra (moneda de la compra). */
  subtotal: Decimal.Value;
  /** Unidades pedidas en toda la compra (para repartir gastos si todo vale 0). */
  totalUnits: number;
  /** Flete, aduana y otros gastos de la compra (moneda de la compra). */
  additionalCosts: Decimal.Value;
  /** Córdobas por unidad de la moneda de la compra (1 en córdobas). */
  exchangeRate: Decimal.Value;
}

/**
 * Costo unitario "puesto en bodega" en córdobas, que es el que entra al costo promedio:
 *
 *   (costo unitario + parte de los gastos) × tipo de cambio
 *
 * Los gastos se reparten por valor: cada línea absorbe gastos en proporción a su subtotal,
 * así que por unidad le tocan costo × gastos / subtotal. Si toda la compra vale 0 (muestras sin
 * costo), los gastos se reparten por unidad.
 */
export function landedUnitCost(input: LandedCostInput): Decimal {
  const unit = new Decimal(input.unitCost);
  const subtotal = new Decimal(input.subtotal);
  const extra = new Decimal(input.additionalCosts);
  let perUnitExtra = new Decimal(0);
  if (extra.greaterThan(0)) {
    if (subtotal.greaterThan(0)) perUnitExtra = unit.times(extra).dividedBy(subtotal);
    else if (input.totalUnits > 0) perUnitExtra = extra.dividedBy(input.totalUnits);
  }
  return cost4(unit.plus(perUnitExtra).times(input.exchangeRate));
}

/** Subtotal de una línea de compra: cantidad × costo, a 2 decimales (igual que el CHECK de la BD). */
export const purchaseLineSubtotal = (quantity: number, unitCost: Decimal.Value): Decimal =>
  money(new Decimal(unitCost).times(quantity));
