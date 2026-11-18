/* Cálculos de vista previa para cotizaciones y ventas (editor de líneas).
   Los montos definitivos los calcula el servidor; la tasa viene de GET /settings. */
import type { CartLine, Producto } from '../types';

export interface Totales {
  sub: number;
  iva: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcTotales(sub: number, taxRate: number): Totales {
  const iva = round2(sub * taxRate);
  return { sub: round2(sub), iva, total: round2(sub + iva) };
}

export function cartTotals(productos: Producto[], lines: CartLine[], taxRate: number): Totales {
  let sub = 0;
  lines.forEach((l) => {
    const p = productos.find((x) => x.id === l.prod);
    if (p) sub += p.precio * (l.cant || 0);
  });
  return calcTotales(sub, taxRate);
}
