/* Advertencias de stock para confirmar ventas (falta, se agota o queda en nivel crítico). */
export interface SummaryLine {
  prod: string;
  nombre: string;
  sku: string;
  cant: number;
  precio: number;
  sub: number;
  /** Existencia actual y mínimo (si se conocen) para advertir. */
  stock?: number;
  min?: number;
  /** Existencia en la sucursal (lo que excede se despacha desde la bodega). */
  suc?: number;
}

export interface StockWarning {
  sku: string;
  nombre: string;
  tipo: 'falta' | 'critico' | 'agota';
  texto: string;
}

/** Advertencias de stock de una lista de líneas: falta, se agota o queda en nivel crítico. */
export function stockWarnings(lines: SummaryLine[]): StockWarning[] {
  const out: StockWarning[] = [];
  for (const l of lines) {
    if (l.stock === undefined) continue;
    const queda = l.stock - l.cant;
    if (queda < 0) out.push({ sku: l.sku, nombre: l.nombre, tipo: 'falta', texto: `solo hay ${l.stock} disponibles (pide ${l.cant})` });
    else if (queda === 0) out.push({ sku: l.sku, nombre: l.nombre, tipo: 'agota', texto: 'queda agotado' });
    else if (l.min !== undefined && queda <= l.min) out.push({ sku: l.sku, nombre: l.nombre, tipo: 'critico', texto: `queda en ${queda} (mínimo ${l.min}): nivel crítico` });
  }
  return out;
}
