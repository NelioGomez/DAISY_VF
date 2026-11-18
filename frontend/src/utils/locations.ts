/* Ubicaciones fijas de NORCOR (mejora n.° 23): una bodega y una sucursal.
   El stock total del producto se reparte entre ambas; las ventas salen primero de la
   sucursal y, si no alcanza, de la bodega. */

export type UbicacionId = 1 | 2;

export const BODEGA: UbicacionId = 1;
export const SUCURSAL: UbicacionId = 2;

export const UBICACIONES: Array<{ id: UbicacionId; codigo: 'BOD' | 'SUC'; nombre: string; corto: string }> = [
  { id: BODEGA, codigo: 'BOD', nombre: 'Bodega principal', corto: 'Bodega' },
  { id: SUCURSAL, codigo: 'SUC', nombre: 'Sucursal principal', corto: 'Sucursal' },
];

export const nombreUbicacion = (id: number | null | undefined): string => UBICACIONES.find((u) => u.id === id)?.nombre ?? '';
export const otraUbicacion = (id: UbicacionId): UbicacionId => (id === BODEGA ? SUCURSAL : BODEGA);
