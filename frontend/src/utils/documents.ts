/* Cálculos compartidos por cotizaciones y ventas (editor de líneas). */
import { IVA } from '../config/business';
import type { CartLine, LineaDocumento, Producto } from '../types';

export interface Totales {
  sub: number;
  iva: number;
  total: number;
}

export function calcTotales(sub: number): Totales {
  const iva = sub * IVA;
  return { sub, iva, total: sub + iva };
}

export function cartTotals(productos: Producto[], lines: CartLine[]): Totales {
  let sub = 0;
  lines.forEach((l) => {
    const p = productos.find((x) => x.id === l.prod);
    if (p) sub += p.precio * (l.cant || 0);
  });
  return calcTotales(sub);
}

export function buildItems(productos: Producto[], lines: CartLine[]): LineaDocumento[] {
  return lines
    .filter((l) => l.prod && l.cant > 0)
    .flatMap((l) => {
      const p = productos.find((x) => x.id === l.prod);
      return p ? [{ prod: p.id, prodN: p.nombre, cant: l.cant, precio: p.precio, sub: p.precio * l.cant }] : [];
    });
}
