/**
 * Rotación de inventario (mejoras n.° 11 y 12), con el mismo criterio en la ficha del producto
 * y en la vista de Inventario:
 * - Días de inventario: cuántos días alcanza el stock al ritmo de venta de los últimos 90 días.
 * - ALTA ≤ 30 días · MEDIA ≤ 90 · BAJA > 90 · SIN_MOVIMIENTO: sin ventas en 90 días.
 */
export type Rotation = 'ALTA' | 'MEDIA' | 'BAJA' | 'SIN_MOVIMIENTO';

export const ROTATION_WINDOW_DAYS = 90;

export function daysOfCover(stock: number, units90: number): number | null {
  if (units90 <= 0) return null;
  return Math.floor(stock / (units90 / ROTATION_WINDOW_DAYS));
}

export function rotationOf(stock: number, units90: number): Rotation {
  const days = daysOfCover(stock, units90);
  if (days === null) return 'SIN_MOVIMIENTO';
  if (days <= 30) return 'ALTA';
  if (days <= 90) return 'MEDIA';
  return 'BAJA';
}
