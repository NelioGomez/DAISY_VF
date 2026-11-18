/* Indicadores compartidos por Dashboard, Inventario, Pagos y Reportes. */
import type { BarDatum } from '../../components/charts/BarChart';
import type { Database } from '../../types';
import { daysAgo, iso } from '../../utils/format';

export const stockCritico = (db: Database) => db.productos.filter((p) => p.stock <= p.stockMin);

export const ventas30Dias = (db: Database) => db.ventas.filter((v) => new Date(v.fecha) >= daysAgo(30)).reduce((a, v) => a + v.total, 0);

export const ventasMesActual = (db: Database) => {
  const now = new Date();
  return db.ventas.filter((v) => {
    const d = new Date(v.fecha + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
};

export const totalCxC = (db: Database) => db.ventas.filter((v) => v.saldo > 0).reduce((a, v) => a + v.saldo, 0);

export const ordenesAbiertas = (db: Database) => db.ordenes.filter((o) => !['Completada', 'Facturada', 'Cancelada'].includes(o.estado));

export function ventasPorDia(db: Database, dias: number): BarDatum[] {
  const buckets: Array<BarDatum & { iso: string }> = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = iso(daysAgo(i));
    buckets.push({ label: new Date(d + 'T00:00:00').toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit' }), iso: d, value: 0 });
  }
  db.ventas.forEach((v) => {
    const b = buckets.find((x) => x.iso === v.fecha);
    if (b) b.value += v.total;
  });
  return buckets;
}
