/* Unidades de medida del inventario (enum UnitOfMeasure de la API).
   La manguera a granel se controla por pie; los terminales y las mangueras armadas, por unidad. */

export type Unidad = 'UNIT' | 'FOOT' | 'METER' | 'PAIR' | 'SET' | 'KIT' | 'BOX' | 'LITER' | 'GALLON';

interface UnidadInfo {
  id: Unidad;
  nombre: string;
  singular: string;
  plural: string;
}

export const UNIDADES: UnidadInfo[] = [
  { id: 'UNIT', nombre: 'Unidad', singular: 'unidad', plural: 'unidades' },
  { id: 'FOOT', nombre: 'Pie', singular: 'pie', plural: 'pies' },
  { id: 'METER', nombre: 'Metro', singular: 'metro', plural: 'metros' },
  { id: 'PAIR', nombre: 'Par', singular: 'par', plural: 'pares' },
  { id: 'SET', nombre: 'Juego', singular: 'juego', plural: 'juegos' },
  { id: 'KIT', nombre: 'Kit', singular: 'kit', plural: 'kits' },
  { id: 'BOX', nombre: 'Caja', singular: 'caja', plural: 'cajas' },
  { id: 'LITER', nombre: 'Litro', singular: 'litro', plural: 'litros' },
  { id: 'GALLON', nombre: 'Galón', singular: 'galón', plural: 'galones' },
];

const BY_ID = new Map(UNIDADES.map((u) => [u.id as string, u]));

export const isUnidad = (v: unknown): v is Unidad => typeof v === 'string' && BY_ID.has(v);

/** "pies" / "pie" según la cantidad. */
export function nombreUnidad(n: number, unidad: string | null | undefined): string {
  const u = BY_ID.get(unidad ?? 'UNIT') ?? UNIDADES[0];
  return n === 1 ? u.singular : u.plural;
}

/** "50 pies", "1 unidad", "5 unidades". */
export const cantidadCon = (n: number, unidad: string | null | undefined): string => `${n.toLocaleString('es-NI')} ${nombreUnidad(n, unidad)}`;

/** Nombre de la unidad en singular ("pie"), para "costo por pie". */
export const unidadSingular = (unidad: string | null | undefined): string => (BY_ID.get(unidad ?? 'UNIT') ?? UNIDADES[0]).singular;
