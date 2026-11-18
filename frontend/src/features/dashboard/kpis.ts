/* Indicadores calculados en el cliente a partir de los datos ya cargados. */
import type { Database } from '../../types';

export const stockCritico = (db: Database) => db.productos.filter((p) => p.activo && p.stock <= p.stockMin);
