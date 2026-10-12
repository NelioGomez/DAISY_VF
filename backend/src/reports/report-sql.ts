import { Prisma } from '../generated/prisma/client';

/** Zona horaria del negocio: los cortes por día/mes se hacen en hora de Nicaragua, obviamente. */
export const BUSINESS_TZ = 'America/Managua';

/**
 * Las columnas "timestamp" se guardan en UTC sin zona. Esto convierte un instante ISO en ese
 * mismo formato, de modo que la comparación no dependa de la zona del servidor ni del driver.
 */
export const ts = (d: Date): Prisma.Sql =>
  Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/** Columna UTC → hora local de Nicaragua (para agrupar por día/semana/mes). Solo recibe constantes. */
export const local = (column: string): Prisma.Sql =>
  Prisma.sql`((${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${Prisma.raw(`'${BUSINESS_TZ}'`)})`;

export interface Range {
  from?: Date;
  to?: Date;
}

/** Condiciones desde/hasta (inclusivas) sobre una columna constante. */
export function rangeConds(column: string, r: Range): Prisma.Sql[] {
  const col = Prisma.raw(column);
  const out: Prisma.Sql[] = [];
  if (r.from) out.push(Prisma.sql`${col} >= ${ts(r.from)}`);
  if (r.to) out.push(Prisma.sql`${col} <= ${ts(r.to)}`);
  return out;
}

export const uuidEq = (column: string, id?: string): Prisma.Sql[] =>
  id ? [Prisma.sql`${Prisma.raw(column)} = ${id}::uuid`] : [];

export function where(conds: Prisma.Sql[]): Prisma.Sql {
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
}

/** numeric (llegado como texto) → número con 2 decimales. */
export const money = (v: unknown): number => Math.round(Number(v ?? 0) * 100) / 100;
export const int = (v: unknown): number => Number(v ?? 0); // Bueno, aquí termina esto, exportante el int.