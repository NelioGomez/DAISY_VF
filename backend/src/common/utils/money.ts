import Decimal from "decimal.js";

/** Redondeo comercial (mitad hacia arriba) a 2 decimales para montos en córdobas. */
export const money = (v: Decimal.Value): Decimal => new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Texto con 2 decimales, aceptado por los campos Decimal de Prisma sin pérdida de precisión. */
export const fixed2 = (v: Decimal.Value): string => money(v).toFixed(2);

/** Costos unitarios: 4 decimales. */
export const cost4 = (v: Decimal.Value): Decimal => new Decimal(v).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
export const fixed4 = (v: Decimal.Value): string => cost4(v).toFixed(4);

export { Decimal };